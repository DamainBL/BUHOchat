import logging

# Intentamos importar con el nombre nuevo, si falla, usamos el viejo
try:
    from duckduckgo_search import DDGS
except ImportError:
    try:
        from ddgs import DDGS
    except ImportError:
        print("❌ Error crítico: No se encuentra la librería de búsqueda.")
        DDGS = None

def search_google(query, max_results=3):
    """
    Busca en internet y devuelve un resumen.
    """
    if not DDGS:
        return "Error: Librería de búsqueda no instalada."

    try:
        print(f"🌎 Buscando en internet: {query}")
        # La librería DDGS es muy rápida
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

        if not results:
            return None

        summary = "Información encontrada en la web:\n"
        for result in results:
            summary += f"- Título: {result.get('title', 'Sin título')}\n"
            summary += f"  Link: {result.get('href', '#')}\n"
            # A veces viene como 'body', a veces como 'snippet'
            body = result.get('body', result.get('snippet', ''))
            summary += f"  Resumen: {body}\n\n"

        return summary

    except Exception as e:
        print(f"❌ Error buscando en internet: {e}")
        return None