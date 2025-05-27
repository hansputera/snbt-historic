import asyncio
import aiohttp
import aiosqlite
import aiofiles
import xmltodict
import csv
import json
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

config = {
    'storage_url': 'https://storage.googleapis.com/pengumuman-snbt-2024-prod-looc9w6bbg/',
    'max_concurrents': 1000
}

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Timestamp untuk nama file
current_timestamp = datetime.now().isoformat()

snbt_files = {
    'excel': f'snbt_dump_{current_timestamp}.csv',
    'db': f'snbt_dump_{current_timestamp}.db',
}

_rct = False

# Maksimal request paralel
MAX_CONCURRENT_REQUESTS = config.get('max_concurrents')
semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

# Gunakan ThreadPoolExecutor untuk tugas yang blocking (parsing XML)
executor = ThreadPoolExecutor()

# How many pages to wait before processing the data
PAGE_PROCESS_THRESHOLD = 20


async def request_data_all():
    """ Mengambil daftar semua file dari storage dengan parallel pagination """
    keys = []
    storage_url = config.get('storage_url')  # e.g., 'https://storage.googleapis.com/storage/v1/b/your-bucket/o'
    params = {'maxResults': 1000}  # Set page size (max results per page)
    page_count = 0  # Track the number of pages fetched
    tasks = []

    async with aiohttp.ClientSession() as session:
        # Initial request to get the first page
        async with session.get(storage_url, params=params) as response:
            if response.status != 200:
                logger.error(f"Failed to fetch data, status code: {response.status}")
                raise Exception(f"Response not 200: {response.status}")
            text = await response.text()

            # Parse XML response asynchronously
            loop = asyncio.get_event_loop()
            dictxml = await loop.run_in_executor(executor, xmltodict.parse, text)

            # Collect keys from the first page
            contents = dictxml.get('ListBucketResult', {}).get('Contents', [])
            keys += [data['Key'] for data in contents if data['Key'].endswith('.dwg')]

            page_count += 1

            # Start processing the keys immediately after collecting enough pages
            if page_count >= PAGE_PROCESS_THRESHOLD:
                await process_keys(keys)
                keys = []  # Reset keys for the next batch

            # Check if there's more data (NextMarker for pagination)
            next_marker = dictxml['ListBucketResult'].get('NextMarker', None)
            if next_marker:
                logger.info(f"Next page found, fetching next marker: {next_marker}")
                tasks.append(fetch_next_page(session, next_marker, keys, storage_url, params, page_count))

        # Run pagination concurrently for the next markers
        while tasks:
            next_task = tasks.pop()
            await next_task


async def fetch_next_page(session, marker, keys, storage_url, params, page_count):
    """ Fetch next page of results and append the keys """
    params['marker'] = marker
    logger.info(f"Fetching next page with marker: {marker}")
    
    async with session.get(storage_url, params=params) as response:
        if response.status != 200:
            logger.error(f"Failed to fetch next page for marker {marker}, status code: {response.status}")
            raise Exception(f"Response not 200 for marker: {marker}")
        text = await response.text()

        # Parse XML response asynchronously
        loop = asyncio.get_event_loop()
        dictxml = await loop.run_in_executor(executor, xmltodict.parse, text)

        # Collect keys
        contents = dictxml.get('ListBucketResult', {}).get('Contents', [])
        keys += [data['Key'] for data in contents if data['Key'].endswith('.dwg')]

        page_count += 1

        # Process the accumulated keys after every PAGE_PROCESS_THRESHOLD pages
        if page_count >= PAGE_PROCESS_THRESHOLD:
            await process_keys(keys)
            keys = []  # Reset keys for the next batch
            page_count = 0  # Reset page count

        # Check for the next marker and queue it for further fetching
        next_marker = dictxml['ListBucketResult'].get('NextMarker', None)
        if next_marker:
            logger.info(f"Next marker found, queuing next page fetch: {next_marker}")
            await fetch_next_page(session, next_marker, keys, storage_url, params, page_count)


async def process_keys(keys):
    """ Process and store the keys immediately after retrieval """
    if not keys:
        return

    logger.info(f"Processing {len(keys)} keys...")

    heads = ['id', 'utbk_no', 'name', 'date_of_birth', 'bidik_misi', 'passed', 'ptn', 'ptn_code', 'prodi', 'prodi_code', 'next_url']

    async with aiosqlite.connect(snbt_files['db']) as db:
        await db.execute(""" 
            CREATE TABLE IF NOT EXISTS snbt_dump (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                utbk_no TEXT NOT NULL,
                name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                bidik_misi INTEGER,
                passed INTEGER NOT NULL,
                ptn TEXT,
                ptn_code INTEGER,
                prodi TEXT,
                prodi_code INTEGER,
                next_url TEXT
            )
        """)

        async with aiohttp.ClientSession() as session, aiofiles.open(snbt_files['excel'], "a", newline="") as csv_file:
            global _rct
            csv_file_writer = csv.writer(csv_file, delimiter=',', quotechar=';')
            if _rct == False:
                await csv_file_writer.writerow(heads)
            else:
                _rct = True

            tasks = [process_single_key(session, db, csv_file_writer, index, key) for index, key in enumerate(keys, start=1)]
            await asyncio.gather(*tasks)

        await db.commit()

    logger.info(f"Processed {len(keys)} keys.")


async def process_single_key(session, db, csv_file_writer, index, key):
    """ Mengambil satu data DWG dan menyimpannya """
    data = await request_data_dwg(session, key)

    # Skip jika DWG atau error
    if data is None:
        return

    row = [
        str(index),  # id
        data['no'],
        data['na'],
        data['dob'],
        str(data['bm']),
        str(data['ac']),
        data['npt'],
        str(data['kpt']),
        data['nps'],
        str(data['kps']),
        data['upt'],
    ]

    # Menulis ke CSV secara async
    await csv_file_writer.writerow(row)

    # Insert ke SQLite secara batch untuk performa maksimal
    await db.execute(""" 
        INSERT INTO snbt_dump (utbk_no, name, date_of_birth, bidik_misi, passed, ptn, ptn_code, prodi, prodi_code, next_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, row[1:])  # Exclude 'id' karena auto-increment


async def request_data_dwg(session, key: str):
    """ Mengambil data DWG secara async, menangani JSON dan DWG """
    async with semaphore:
        async with session.get(config.get('storage_url') + key, headers={
            'Accept': 'application/json'
        }) as response:
            if response.status != 200:
                logger.error(f"Failed to fetch DWG data for key: {key}, status code: {response.status}")
                raise Exception(f"Response not 200 for key: {key}")
            
            try:
                logger.info(f'Fetching DWG data for key: {key}')
                text = await response.text()
                return json.loads(text)
            except Exception as e:
                logger.warning(f"Error parsing DWG data for key: {key}, error: {e}")
                return None


async def main():
    current_time = datetime.now()
    logger.info('Retrieving data keys...')
    keys = await request_data_all()
    logger.info(f'Receiving {len(keys)} keys')

    await process_keys(keys)
    logger.info(f'Time taken: {(datetime.now() - current_time).total_seconds()}s')


asyncio.run(main())