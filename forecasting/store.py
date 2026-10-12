"""Read reference snapshots and atomically publish validated offline batches."""
import argparse
from datetime import date, datetime
import hashlib
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo

from forecasting.refresh import validate_snapshot

ROOT = Path(__file__).resolve().parents[1]


def export_snapshot(connection):
    with connection.cursor() as cursor:
        # One statement has one MVCC snapshot: metadata and records cannot
        # straddle a concurrent active-version switch.
        cursor.execute('''SELECT b.metadata, r.record, b.id
            FROM price_forecast_active a JOIN price_forecast_batch b ON b.id = a.batch_id
            JOIN price_forecast_record r ON r.batch_id = b.id
            ORDER BY r.item_code, r.region_id''')
        rows = cursor.fetchall()
    if not rows:
        raise ValueError('No active forecast batch; seed the initial snapshot first')
    return {**rows[0][0], 'records': [r[1] for r in rows]}, rows[0][2]


def publish(connection, snapshot, *, today=None, expected_active=None, keep=2):
    """Validate first; a failed transaction cannot change the active version."""
    today = today or datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).date()
    validate_snapshot(snapshot, today)
    if keep < 2:
        raise ValueError('Retain at least the current and previous batches')
    digest = hashlib.sha256(json.dumps(snapshot,allow_nan=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    metadata = {k:v for k,v in snapshot.items() if k != 'records'}
    from psycopg.types.json import Jsonb
    with connection.transaction():
        with connection.cursor() as cursor:
            # Serialise publishers, including the first seed when no pointer exists.
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext('smartcart_forecast_publish'))")
            cursor.execute('''SELECT b.id, b.data_cutoff, b.generated_at
                FROM price_forecast_active a JOIN price_forecast_batch b ON b.id=a.batch_id''')
            active = cursor.fetchone()
            actual_id = active[0] if active else 'none'
            if expected_active is not None and actual_id != expected_active:
                raise ValueError('Active forecast changed during generation; retry from the newer reference')
            generated = datetime.fromisoformat(snapshot['generated_at'])
            if generated.tzinfo is None:
                raise ValueError('Timezone-aware generation timestamp required')
            cutoff = date.fromisoformat(snapshot['data_cutoff'])
            if active and (cutoff < active[1] or generated < active[2]):
                raise ValueError('Refusing to publish older source data or an older generation')
            cursor.execute('''INSERT INTO price_forecast_batch (id,generated_at,data_cutoff,metadata,record_count)
                VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING''',
                (digest,generated,cutoff,Jsonb(metadata),len(snapshot['records'])))
            cursor.executemany('''INSERT INTO price_forecast_record (batch_id,item_code,region_id,record)
                VALUES (%s,%s,%s,%s) ON CONFLICT (batch_id,item_code,region_id) DO NOTHING''',
                [(digest,r['item_code'],r['region_id'],Jsonb(r)) for r in snapshot['records']])
            cursor.execute('SELECT count(*) FROM price_forecast_record WHERE batch_id=%s',(digest,))
            if cursor.fetchone()[0] != len(snapshot['records']):
                raise ValueError('Published batch is incomplete')
            cursor.execute('''INSERT INTO price_forecast_active (singleton,batch_id) VALUES (TRUE,%s)
                ON CONFLICT(singleton) DO UPDATE SET batch_id=EXCLUDED.batch_id''',(digest,))
            # Keep the former active version even if an older concurrent candidate
            # had a later timestamp. Only delete records owned by this subsystem.
            protected = [digest] + ([active[0]] if active else [])
            cursor.execute('''DELETE FROM price_forecast_batch WHERE id <> ALL(%s)
                AND id NOT IN (SELECT id FROM price_forecast_batch
                    ORDER BY generated_at DESC, id LIMIT %s)''',(protected,keep))
    return digest


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['migrate','export','publish'])
    parser.add_argument('--file',type=Path)
    parser.add_argument('--expected-active')
    parser.add_argument('--bootstrap-from',type=Path)
    args=parser.parse_args()
    url=os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL')
    if not url:
        raise ValueError('DATABASE_URL must be supplied securely by the job environment')
    import psycopg
    with psycopg.connect(url,connect_timeout=15) as connection:
        if args.action=='migrate':
            with connection.cursor() as cursor:
                cursor.execute((ROOT/'database/migrations/003_price_forecasts.sql').read_text())
            print('Forecast tables ready')
        elif args.action=='export':
            if not args.file:raise ValueError('--file is required')
            try:
                snapshot,active=export_snapshot(connection)
            except ValueError:
                if not args.bootstrap_from:raise
                snapshot=json.loads(args.bootstrap_from.read_text(encoding='utf-8'))
                active='none'
            args.file.parent.mkdir(parents=True,exist_ok=True)
            args.file.write_text(json.dumps(snapshot,allow_nan=False,separators=(',',':')),encoding='utf-8')
            # Active ID and records were read in the same SQL statement.
            args.file.with_suffix('.active-id').write_text(active,encoding='utf-8')
            print('Active forecast snapshot exported')
        else:
            if not args.file:raise ValueError('--file is required')
            snapshot=json.loads(args.file.read_text(encoding='utf-8'))
            print(json.dumps({'published_batch':publish(connection,snapshot,expected_active=args.expected_active)}))


if __name__=='__main__':main()
