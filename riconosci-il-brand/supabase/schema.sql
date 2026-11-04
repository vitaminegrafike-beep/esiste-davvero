-- =====================================================================
-- Zoom Race · database Supabase
-- Da incollare UNA volta in Supabase → SQL Editor → New query → Run.
-- Si può rieseguire senza danni: crea solo ciò che manca e aggiorna le funzioni.
--
-- Regole:
--  * Il server è la fonte di verità per fase, orari e punteggi.
--  * Dal browser si possono solo LEGGERE partite e giocatori (per il tempo reale).
--  * Ogni scrittura passa dalle funzioni qui sotto (security definer).
--  * Token della regia, segreti dei giocatori e risposte non sono leggibili dal browser.
-- =====================================================================

-- Ora del server in millisecondi
create or replace function zr_ms() returns bigint
language sql volatile as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- ---------- Tabelle ----------

create table if not exists zr_games (
  id         uuid primary key default gen_random_uuid(),
  created_ms bigint not null default zr_ms(),
  state      text   not null default 'lobby'
             check (state in ('lobby','countdown','round','reveal','final','podium','closed')),
  round      int    not null default 0 check (round between 0 and 50),
  phase_ms   bigint not null default zr_ms(),     -- inizio della fase corrente
  ends_ms    bigint,                              -- fine del round (solo in fase 'round')
  round_ms   int    not null default 12000        -- durata del round
);

create table if not exists zr_hosts (             -- token della regia: mai leggibile dal browser
  game_id uuid primary key references zr_games(id) on delete cascade,
  token   uuid not null default gen_random_uuid()
);

create table if not exists zr_players (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references zr_games(id) on delete cascade,
  nickname       text not null check (char_length(nickname) between 1 and 16),
  avatar         int  not null check (avatar between 0 and 15),   -- uno dei 16 personaggi
  total_score    int  not null default 0,
  last_score     int  not null default 0,        -- punti dell'ultimo round chiuso
  total_ms       int  not null default 0,        -- somma dei tempi delle risposte esatte (spareggio)
  correct_count  int  not null default 0,
  answered_round int  not null default 0,        -- ultimo round a cui ha risposto (aura in regia)
  joined_ms      bigint not null default zr_ms(),
  unique (game_id, avatar)
);
create index if not exists zr_players_game on zr_players(game_id);
alter table zr_games alter column round_ms set default 12000;   -- round da 12 s (anche su database già creati)

create table if not exists zr_secrets (           -- segreto del giocatore: mai leggibile dal browser
  player_id uuid primary key references zr_players(id) on delete cascade,
  secret    uuid not null default gen_random_uuid()
);

create table if not exists zr_answers (           -- risposte: mai leggibili dal browser
  player_id   uuid not null references zr_players(id) on delete cascade,
  game_id     uuid not null references zr_games(id) on delete cascade,
  round       int  not null,
  choice      int  not null check (choice between 0 and 2),
  response_ms int  not null,                      -- calcolato dal server
  primary key (player_id, round)
);

-- ---------- Accesso dal browser ----------

alter table zr_games   enable row level security;
alter table zr_hosts   enable row level security;
alter table zr_players enable row level security;
alter table zr_secrets enable row level security;
alter table zr_answers enable row level security;

drop policy if exists zr_games_read on zr_games;
create policy zr_games_read on zr_games for select to anon, authenticated using (true);
drop policy if exists zr_players_read on zr_players;
create policy zr_players_read on zr_players for select to anon, authenticated using (true);

revoke all on zr_games, zr_players, zr_hosts, zr_secrets, zr_answers from anon, authenticated;
grant select on zr_games, zr_players to anon, authenticated;

-- Tempo reale solo su partite e giocatori
do $$ begin
  alter publication supabase_realtime add table zr_games;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table zr_players;
exception when duplicate_object then null; end $$;

-- ---------- Funzioni ----------

-- Ora del server, per allineare il blur sui telefoni
create or replace function zr_now() returns bigint
language sql volatile security definer set search_path = public as $$ select zr_ms() $$;

-- Nuova partita (regia): chiude le precedenti, restituisce il token della regia
create or replace function zr_create_game() returns json
language plpgsql security definer set search_path = public as $$
declare g zr_games; t uuid;
begin
  update zr_games set state = 'closed', phase_ms = zr_ms() where state <> 'closed';
  delete from zr_games where created_ms < zr_ms() - 7::bigint * 24 * 3600 * 1000;   -- pulizia dopo 7 giorni
  insert into zr_games default values returning * into g;
  insert into zr_hosts(game_id) values (g.id) returning token into t;
  return json_build_object('game_id', g.id, 'host_token', t);
end $$;

-- Ingresso di un giocatore (telefono)
create or replace function zr_join(p_game uuid, p_nickname text, p_avatar int) returns json
language plpgsql security definer set search_path = public as $$
declare g zr_games; n int; pid uuid; s uuid; nick text := left(btrim(coalesce(p_nickname, '')), 16);
begin
  if nick = '' then raise exception 'name'; end if;
  if p_avatar is null or p_avatar < 0 or p_avatar > 15 then raise exception 'avatar'; end if;
  select * into g from zr_games where id = p_game for update;           -- un ingresso alla volta
  if not found or g.state <> 'lobby' then raise exception 'not_open'; end if;
  select count(*) into n from zr_players where game_id = p_game;
  if n >= 16 then raise exception 'full'; end if;
  if exists (select 1 from zr_players where game_id = p_game and avatar = p_avatar) then raise exception 'taken'; end if;
  insert into zr_players(game_id, nickname, avatar) values (p_game, nick, p_avatar) returning id into pid;
  insert into zr_secrets(player_id) values (pid) returning secret into s;
  return json_build_object('player_id', pid, 'secret', s);
end $$;

-- Risposta (telefono): una sola per round, tempo misurato dal server
create or replace function zr_answer(p_player uuid, p_secret uuid, p_round int, p_choice int) returns json
language plpgsql security definer set search_path = public as $$
declare pl zr_players; g zr_games; t bigint := zr_ms(); ms int;
begin
  select p.* into pl from zr_players p join zr_secrets s on s.player_id = p.id
   where p.id = p_player and s.secret = p_secret;
  if not found then raise exception 'auth'; end if;
  if p_choice is null or p_choice < 0 or p_choice > 2 then raise exception 'choice'; end if;
  select * into g from zr_games where id = pl.game_id for share;        -- aspetta un'eventuale chiusura in corso
  if g.state <> 'round' or g.round <> p_round then return json_build_object('ok', false, 'reason', 'closed'); end if;
  if t > g.ends_ms + 500 then return json_build_object('ok', false, 'reason', 'late'); end if;   -- 0,5 s di tolleranza
  ms := greatest(0, least(g.round_ms, (t - g.phase_ms - 200)::int));  -- 0,2 s di compensazione per la rete
  insert into zr_answers(player_id, game_id, round, choice, response_ms)
  values (p_player, g.id, p_round, p_choice, ms) on conflict do nothing;
  if not found then return json_build_object('ok', false, 'reason', 'dup'); end if;
  update zr_players set answered_round = p_round where id = p_player;
  return json_build_object('ok', true);
end $$;

-- Cambio di fase (solo regia, con token).
-- 'reveal' chiude il round: calcola i punti con la risposta giusta passata dalla regia.
-- Punti: esatta = round(100 - ms/durata*70), da 100 a 30; errata o mancante = 0.
create or replace function zr_host(p_game uuid, p_token uuid, p_state text, p_round int, p_correct int default null) returns json
language plpgsql security definer set search_path = public as $$
declare g zr_games; t bigint := zr_ms();
begin
  if not exists (select 1 from zr_hosts where game_id = p_game and token = p_token) then raise exception 'auth'; end if;
  select * into g from zr_games where id = p_game for update;
  if g.state = 'closed' then raise exception 'closed'; end if;

  if p_state = 'countdown' then
    -- (ri)parte il round p_round da zero: utile anche se la regia si è ricaricata a metà
    delete from zr_answers where game_id = p_game and round = p_round;
    update zr_players set answered_round = least(answered_round, p_round - 1) where game_id = p_game;
    update zr_games set state = 'countdown', round = p_round, phase_ms = t, ends_ms = null where id = p_game;

  elsif p_state = 'round' then
    update zr_games set state = 'round', round = p_round, phase_ms = t, ends_ms = t + round_ms where id = p_game;

  elsif p_state = 'reveal' then
    if g.state = 'round' and g.round = p_round then                       -- i punti si contano una volta sola
      if p_correct is null or p_correct < 0 or p_correct > 2 then raise exception 'correct'; end if;
      update zr_players p set
        last_score    = x.score,
        total_score   = p.total_score + x.score,
        total_ms      = p.total_ms + x.ms,
        correct_count = p.correct_count + (x.score > 0)::int
      from (
        select pl.id,
               case when a.choice = p_correct then round(100 - a.response_ms::numeric / g.round_ms * 70)::int else 0 end as score,
               case when a.choice = p_correct then a.response_ms else 0 end as ms
          from zr_players pl
          left join zr_answers a on a.player_id = pl.id and a.round = p_round
         where pl.game_id = p_game
      ) x
      where p.id = x.id;
    end if;
    update zr_games set state = 'reveal', phase_ms = t, ends_ms = null where id = p_game;

  elsif p_state in ('lobby', 'final', 'podium', 'closed') then
    update zr_games set state = p_state, phase_ms = t, ends_ms = null where id = p_game;

  else
    raise exception 'state';
  end if;

  select * into g from zr_games where id = p_game;
  return row_to_json(g);
end $$;

revoke all on function zr_now(), zr_create_game(), zr_join(uuid, text, int),
  zr_answer(uuid, uuid, int, int), zr_host(uuid, uuid, text, int, int) from public;
grant execute on function zr_now(), zr_create_game(), zr_join(uuid, text, int),
  zr_answer(uuid, uuid, int, int), zr_host(uuid, uuid, text, int, int) to anon, authenticated;
