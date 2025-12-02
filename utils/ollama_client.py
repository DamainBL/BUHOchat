import os
from groq import Groq

# Configuración
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
# Usamos Llama 3.3 70B Versatile, que es MUY inteligente y rápido
GROQ_MODEL = "llama-3.3-70b-versatile"

# Personalidad del Búho
PERSONALIDAD_BUHO = """
Eres "Búho", el asistente virtual no oficial de la Universidad Nacional de Colombia (UNAL).
Fuiste creado y programado por Estudiantes de la UNAL.
Tu objetivo es ayudar a estudiantes y aspirantes con información sobre la universidad.

Reglas de comportamiento:
0. Por cierto, tu nombre es búho y tu identidad es búho nada de llamarte como otra cosa. Eres búho
1. SIEMPRE responde en español.
2. Si te preguntan tu nombre, di "Soy Búho". NUNCA digas que eres Gemma, Llama o una IA de Google/Meta.
3. Sé amable, usa un tono universitario pero respetuoso.
4. Si no sabes algo, di que no tienes esa información por el momento, no inventes datos.
5. Tus respuestas deben ser claras y concisas.
6. Tampoco vas a inventar links a páginas que no existan o bueno en general no te inventes links a páginas. Más que las que te voy a dejar a continuación, https://admisiones.unal.edu.co/, https://posgrados.unal.edu.co/, https://admisiones.unal.edu.co/pregrado/oferta-de-programas-curriculares/, https://sia.unal.edu.co/, https://unal.edu.co/calendario-academico, https://dfa.bogota.unal.edu.co/division-vigilancia-seguridad/, https://legal.unal.edu.co/rlunal/home/


Informacion Adicional:
1. Bareto se le conoce popularmente al porro o cigarrillo de marihuana, no al de bazuco u otras sustancias alucinógenas, cuando se mezcla marihuana y bazuco se le llama "maduro" y cuando es solo bazuco se le conoce como "carro".
2. Para cosas que desafien normativa de la unal, siempre debes redirigir al usuario a la página oficial de la legalidad en la unal, https://legal.unal.edu.co/rlunal/home/
3. El ingreso de bebidas alcoholicas a la unal esta prohibido, por lo tanto si el usuario pregunta sobre el ingreso de alcohol a la unal, debes redirigirlo a la página oficial de la legalidad en la unal, https

"""


def ask_ollama(prompt, history=None, model=None):
    """
    NOTA: Aunque la función se llama 'ask_ollama' para no romper app.py,
    ahora se conecta a GROQ (Nube).
    """

    # Verificación de seguridad
    if not GROQ_API_KEY:
        return {
            "success": False,
            "error": "Falta la API Key de Groq. Configúrala en los Secrets."
        }

    try:
        # Inicializamos el cliente de Groq
        client = Groq(api_key=GROQ_API_KEY)

        # Preparamos los mensajes
        messages = []

        # 1. System Prompt (Personalidad)
        messages.append({"role": "system", "content": PERSONALIDAD_BUHO})

        # 2. Historial (limpiamos el formato para asegurarnos que Groq lo entienda)
        if history:
            for msg in history:
                # Aseguramos que solo pasen roles válidos y contenido strings
                if "role" in msg and "content" in msg:
                    messages.append({
                        "role": msg["role"],
                        "content": str(msg["content"])
                    })

        # 3. Mensaje actual
        messages.append({"role": "user", "content": prompt})

        # Hacemos la petición a la Nube
        chat_completion = client.chat.completions.create(
            messages=messages,
            model=GROQ_MODEL,
            temperature=0.5,  # Un poco más bajo para ser más preciso con datos
            max_tokens=1024,
        )

        # Obtenemos la respuesta
        respuesta = chat_completion.choices[0].message.content

        return {"success": True, "content": respuesta, "role": "assistant"}

    except Exception as e:
        print(f"❌ Error con Groq: {e}")
        return {"success": False, "error": f"Error en la nube: {str(e)}"}


def check_ollama_connection():
    """
    Verifica si tenemos la Key de Groq configurada.
    """
    if GROQ_API_KEY:
        return True
    return False


def classify_user_intent(user_message):
    """
    Usa un modelo PEQUEÑO y RÁPIDO (Llama 8B) para clasificar la intención del usuario.
    Retorna una categoría: 'ADMISIONES', 'POSGRADOS', 'CALENDARIO', 'PROGRAMAS', 'MATERIAS', o 'NINGUNO'.
    """
    if not GROQ_API_KEY:
        return "NINGUNO"

    try:
        client = Groq(api_key=GROQ_API_KEY)

        # Prompt estricto para que solo devuelva la categoría
        system_prompt = """
        Eres un clasificador de intenciones. Tu ÚNICO trabajo es leer el mensaje del usuario y clasificarlo en UNA de estas categorías:

        1. ADMISIONES (Si pregunta sobre exámenes, inscripciones a pregrado, puntajes, pasar a la U).
        2. POSGRADOS (Si pregunta sobre maestrías, doctorados, especializaciones).
        3. CALENDARIO (Si pregunta fechas, cuándo empieza semestre, cuándo acaba).
        4. PROGRAMAS (Si pregunta qué carreras hay, lista de ingenierías, planes de estudio).
        5. MATERIAS (Si pregunta sobre créditos, asignaturas, clases específicas).
        6. SEGURIDAD (Si pregunta sobre emergencias, vigilancia, objetos perdidos, denuncias, líneas de atención, seguridad en el campus).
        6. NINGUNO (Si es un saludo, una pregunta general, filosofía, chiste, o no tiene que ver con datos de la web).

        REGLA DE ORO: Responde SOLAMENTE con la palabra de la categoría. No digas "La categoría es...". Solo la palabra.
        """

        completion = client.chat.completions.create(
            # Usamos el modelo 8B Instant (Ultra rápido y ligero)
            model="llama-3.1-8b-instant",
            messages=[{
                "role": "system",
                "content": system_prompt
            }, {
                "role": "user",
                "content": user_message
            }],
            temperature=0,  # Temperatura 0 para que sea preciso y robótico
            max_tokens=10)

        category = completion.choices[0].message.content.strip().upper()

        # Limpieza extra por si la IA se pone creativa (quitamos puntos o espacios)
        category = category.replace(".", "").replace("'", "").replace('"', "")

        print(f"🧠 Cerebro Pequeño clasificó: '{user_message}' -> [{category}]")
        return category

    except Exception as e:
        print(f"❌ Error en clasificación: {e}")
        return "NINGUNO"
