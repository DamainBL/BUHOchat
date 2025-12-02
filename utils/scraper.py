from bs4 import BeautifulSoup
import requests
from utils.ollama_client import classify_user_intent
from utils.search_tool import search_google

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS


# --- FUNCIÓN NUEVA: EL LECTOR DE PÁGINAS ---
def visit_and_scrape_url(url):
    """
    Entra a una URL y extrae el texto real (Párrafos y tablas).
    """
    try:
        print(f"🕵️‍♂️ Entrando a leer: {url}")
        headers = {
            'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)

        soup = BeautifulSoup(response.text, "html.parser")

        # Eliminamos basura (menús, scripts, estilos)
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()

        # Buscamos tablas (donde suelen estar las fechas) y párrafos
        content = []

        # 1. Intentar leer tablas (Ideal para calendarios)
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            for row in rows:
                cols = [
                    ele.get_text(strip=True)
                    for ele in row.find_all(["td", "th"])
                ]
                if cols:
                    content.append(" | ".join(cols))

        # 2. Leer párrafos importantes
        paragraphs = soup.find_all(["p", "li", "h2", "h3"])
        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) > 20:  # Solo texto sustancial
                content.append(text)

        # Unimos todo y cortamos si es muy largo (para no saturar a la IA)
        full_text = "\n".join(content)
        return full_text[:4000]  # Devolvemos los primeros 4000 caracteres

    except Exception as e:
        print(f"❌ Error leyendo la página {url}: {e}")
        return None


def scrape_admisiones_unal():
    """Extrae información de la página de admisiones de la UNAL."""
    try:
        url = "https://admisiones.unal.edu.co/"
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")
        titles = [
            t.get_text(strip=True) for t in soup.select(".list-group-item")
        ]
        return "\n".join(titles[:10])
    except Exception as e:
        print(f"Error scraping admisiones: {e}")
        return ""


def scrape_posgrados_unal():
    """Extrae información de la página de posgrados de la UNAL."""
    try:
        url = "https://posgrados.unal.edu.co/"
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")
        titles = [
            t.get_text(strip=True)
            for t in soup.select("h3, h4, p, .list-group-item")
        ]
        return "\n".join(titles[:15])
    except Exception as e:
        print(f"Error scraping posgrados: {e}")
        return ""


def scrape_programas_unal():
    """Extrae información de programas curriculares de la UNAL."""
    try:
        url = "https://admisiones.unal.edu.co/pregrado/oferta-de-programas-curriculares/"
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")
        programas = [
            t.get_text(strip=True) for t in soup.select(".list-group-item")
            if "Créditos" not in t.get_text()
        ]
        return "\n".join(programas[:20])
    except Exception as e:
        print(f"Error scraping programas: {e}")
        return ""


def scrape_materias_unal():
    """Extrae información del SIA de la UNAL."""
    try:
        url = "https://sia.unal.edu.co/"
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")
        materias = [
            t.get_text(strip=True)
            for t in soup.select("h3, h4, a, p, .list-group-item")
            if "Créditos" not in t.get_text()
        ]
        return "\n".join(materias[:20])
    except Exception as e:
        print(f"Error scraping materias: {e}")
        return ""


def scrape_calendario_unal():
    """
    1. Busca en Google.
    2. Extrae el primer link.
    3. Entra y lee el contenido real.
    """
    try:
        # Buscamos específicamente el de Bogotá que es el que pediste
        query = "Calendario Académico Sede Bogotá 2025 fechas detalladas"
        print(f"🔎 Buscando link para: {query}")

        # Usamos DDGS directamente para obtener el link crudo
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=1))

        if not results:
            return "No encontré resultados en la web."

        # Tomamos el primer resultado
        top_result = results[0]
        url = top_result['href']
        snippet = top_result['body']

        # PASO CRÍTICO: Entrar a la página
        page_content = visit_and_scrape_url(url)

        if page_content:
            return f"FUENTE: {url}\n\nCONTENIDO EXTRAÍDO DE LA PÁGINA:\n{page_content}"
        else:
            # Si falló la lectura, devolvemos al menos el resumen de Google
            return f"No pude leer la página completa, pero Google dice esto: {snippet} (Link: {url})"

    except Exception as e:
        print(f"Error en proceso de calendario: {e}")
        return "Error buscando calendario."

def scrape_seguridad_unal():
    """
    Lee directamente la página de la División de Vigilancia y Seguridad.
    """
    url = "https://dfa.bogota.unal.edu.co/division-vigilancia-seguridad/"
    print(f"👮 Visitando página de seguridad: {url}")

    # Reutilizamos tu función maestra de lectura
    content = visit_and_scrape_url(url)

    if content:
        return f"FUENTE OFICIAL DE SEGURIDAD: {url}\n\nINFORMACIÓN EXTRAÍDA:\n{content}"
    else:
        return "No pude leer la página de seguridad en este momento."

def detect_topic_and_scrape(user_message):
    """
        Usa IA para detectar el tema y decide qué scrapear.
        """
    # 1. Llamamos al modelo pequeño para que decida
    topic = classify_user_intent(user_message)

    data = None

    # 2. Ejecutamos el scraper según lo que dijo la IA
    if topic == "ADMISIONES":
        print("running scraper: ADMISIONES")
        data = scrape_admisiones_unal()

    elif topic == "POSGRADOS":
        print("running scraper: POSGRADOS")
        data = scrape_posgrados_unal()

    elif topic == "CALENDARIO":
        print("running search: CALENDARIO")
        # Esto ahora llamará a DuckDuckGo en lugar de Beautiful Soup
        data = scrape_calendario_unal()

    elif topic == "PROGRAMAS":
        print("running scraper: PROGRAMAS")
        data = scrape_programas_unal()

    elif topic == "SEGURIDAD":
        print("running scraper: SEGURIDAD")
        data = scrape_seguridad_unal()

    elif topic == "MATERIAS":
        print("running scraper: MATERIAS")
        data = scrape_materias_unal()

    else:
        print("🤖 Tema 'NINGUNO' o desconocido. No se hace scraping.")
        return None

    return data
