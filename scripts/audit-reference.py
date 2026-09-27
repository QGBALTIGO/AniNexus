"""Read-only public reference capture using Scrapling; no account or private pages."""
import json
import pathlib
from urllib.parse import urljoin
from scrapling.fetchers import Fetcher

output = pathlib.Path('audit-artifacts/reference')
output.mkdir(parents=True, exist_ok=True)
origin = 'https://www.aniquim.com.br/'
home = Fetcher.get(origin, timeout=25)
links = home.css('a::attr(href)').getall()
targets = [('home', origin)]
for label, prefix in [('catalog', '/animes/catalogo'), ('detail', '/anime/'), ('schedule', '/animes/programacao'), ('season', '/animes/temporadas'), ('community', '/comunidade')]:
    found = next((urljoin(origin, link) for link in links if urljoin(origin, link).startswith(urljoin(origin, prefix))), None)
    if found:
        targets.append((label, found))
records = []
styles = {}
for label, url in targets:
    page = home if label == 'home' else Fetcher.get(url, timeout=25)
    record = {'page': label, 'url': url, 'status': page.status, 'title': page.css('title::text').get(), 'links': page.css('a::attr(href)').getall(), 'stylesheets': page.css('link[rel="stylesheet"]::attr(href)').getall()}
    if page.status == 200:
        # The archive is reference evidence, never product source or a replacement design.
        (output / f'{label}.html').write_text(str(page.html_content), encoding='utf-8')
        for href in record['stylesheets']:
            style_url = urljoin(origin, href)
            if style_url not in styles:
                style = Fetcher.get(style_url, timeout=25)
                if style.status == 200:
                    name = f'style-{len(styles)}.css'
                    (output / name).write_bytes(style.body)
                    styles[style_url] = name
    records.append(record)
    print(json.dumps({'page': label, 'url': url, 'status': page.status, 'title': record['title']}, ensure_ascii=True))
(output / 'index.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
(output / 'styles.json').write_text(json.dumps(styles, indent=2), encoding='utf-8')
