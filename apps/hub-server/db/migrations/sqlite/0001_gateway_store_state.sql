create table if not exists gateway_store_state (
  id integer primary key check (id = 1),
  snapshot_json text not null,
  updated_at text not null
);
