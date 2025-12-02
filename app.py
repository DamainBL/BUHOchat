import os
import time
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from collections import defaultdict
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from utils.scraper import detect_topic_and_scrape
from utils.ollama_client import ask_ollama, check_ollama_connection

load_dotenv()

db = None
firebase_initialized = False

try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    firebase_initialized = True
    print("✅ Firebase Admin inicializado correctamente.")
except FileNotFoundError:
    print("⚠️  ADVERTENCIA: No se encontró 'serviceAccountKey.json'.")
    print("   Las funciones de Firestore (guardar chat) no funcionarán.")
    print("   Por favor, configura Firebase para usar todas las funcionalidades.")
except Exception as e:
    print(f"❌ Error al inicializar Firebase Admin: {e}")
    print("   El servidor continuará sin Firebase.")

app = Flask(__name__)
app.secret_key = os.environ.get('SESSION_SECRET', 'dev-secret-key-change-in-production')
CORS(app)

rate_limit_tracker = defaultdict(list)
login_attempts = {}
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 20
LOGIN_ATTEMPT_LIMIT = 5
LOGIN_LOCKOUT_DURATION = 900


@app.route('/')
def index():
    """Renderiza la página principal con las credenciales de Firebase"""
    return render_template(
        'index.html',
        firebase_api_key=os.environ.get('FIREBASE_API_KEY'),
        firebase_project_id=os.environ.get('FIREBASE_PROJECT_ID'),
        firebase_app_id=os.environ.get('FIREBASE_APP_ID'),
    )


@app.route('/account')
def account():
    """Renderiza la página de cuenta del usuario"""
    return render_template(
        'account.html',
        firebase_api_key=os.environ.get('FIREBASE_API_KEY'),
        firebase_project_id=os.environ.get('FIREBASE_PROJECT_ID'),
        firebase_app_id=os.environ.get('FIREBASE_APP_ID'),
    )


@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Crea una nueva conversación vacía para el usuario."""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    
    if not firebase_initialized or db is None:
        return jsonify({'error': 'Firebase no está configurado'}), 503

    user_id = session['user_id']

    try:
        update_time, doc_ref = db.collection('conversations').add({
            'userId': user_id,
            'title': 'Nueva conversación',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'messageCount': 0,
            'messages': []
        })

        return jsonify({'conversationId': doc_ref.id}), 201

    except Exception as e:
        print(f"❌ Error al crear conversación: {e}")
        return jsonify({'error': 'Error al crear la conversación'}), 500


@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Obtiene la lista de conversaciones del usuario."""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    
    if not firebase_initialized or db is None:
        return jsonify({'error': 'Firebase no está configurado'}), 503

    user_id = session['user_id']

    try:
        conv_ref = db.collection('conversations')
        query = conv_ref.where(filter=FieldFilter('userId', '==', user_id))
        convs = query.stream()

        conversation_list = []
        for conv in convs:
            data = conv.to_dict()
            created_at = data.get('createdAt')
            updated_at = data.get('updatedAt', created_at)
            conversation_list.append({
                'id': conv.id,
                'title': data.get('title', 'Conversación'),
                'messageCount': data.get('messageCount', 0),
                'updatedAt': updated_at,
                'createdAt': created_at
            })

        conversation_list.sort(key=lambda x: x.get('updatedAt') or x.get('createdAt') or 0, reverse=True)
        
        return jsonify(conversation_list), 200

    except Exception as e:
        print(f"❌ Error al obtener conversaciones: {e}")
        return jsonify({'error': 'Error al obtener las conversaciones'}), 500


@app.route('/api/conversations/<conv_id>', methods=['GET'])
def get_conversation_history(conv_id):
    """Obtiene el historial completo de mensajes de una conversación."""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    
    if not firebase_initialized or db is None:
        return jsonify({'error': 'Firebase no está configurado'}), 503

    user_id = session['user_id']

    try:
        doc_ref = db.collection('conversations').document(conv_id)
        doc = doc_ref.get()

        if not doc.exists:
            return jsonify({'error': 'Conversación no encontrada'}), 404

        data = doc.to_dict()

        if not data or data.get('userId') != user_id:
            return jsonify({'error': 'Acceso no autorizado'}), 403

        return jsonify(data), 200

    except Exception as e:
        print(f"❌ Error al obtener historial: {e}")
        return jsonify({'error': 'Error al obtener el historial'}), 500


@app.route('/api/conversations/<conv_id>', methods=['DELETE'])
def delete_conversation(conv_id):
    """Elimina una conversación."""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    
    if not firebase_initialized or db is None:
        return jsonify({'error': 'Firebase no está configurado'}), 503

    user_id = session['user_id']

    try:
        doc_ref = db.collection('conversations').document(conv_id)
        doc = doc_ref.get()

        if not doc.exists:
            return jsonify({'error': 'Conversación no encontrada'}), 404

        data = doc.to_dict()
        
        if not data or data.get('userId') != user_id:
            return jsonify({'error': 'Acceso no autorizado'}), 403

        doc_ref.delete()
        return jsonify({'success': True}), 200

    except Exception as e:
        print(f"❌ Error al eliminar conversación: {e}")
        return jsonify({'error': 'Error al eliminar la conversación'}), 500


def check_rate_limit(user_id, endpoint):
    """Verifica límite de peticiones por usuario"""
    now = time.time()
    key = f"{user_id}_{endpoint}"
    
    rate_limit_tracker[key] = [t for t in rate_limit_tracker[key] if now - t < RATE_LIMIT_WINDOW]
    
    if len(rate_limit_tracker[key]) >= RATE_LIMIT_MAX_REQUESTS:
        return False, 'Demasiadas peticiones. Por favor, espera un momento.'
    
    rate_limit_tracker[key].append(now)
    return True, None


def check_login_attempts(email):
    """Verifica y controla intentos de login"""
    now = time.time()
    
    if email in login_attempts:
        attempt_data = login_attempts[email]
        
        locked_until = attempt_data.get('locked_until')
        if locked_until is not None and locked_until > now:
            remaining_minutes = int((locked_until - now) / 60) + 1
            return False, f'Cuenta bloqueada temporalmente. Intenta de nuevo en {remaining_minutes} minutos.'
        
        attempt_data['attempts'] = [t for t in attempt_data.get('attempts', []) if now - t < LOGIN_LOCKOUT_DURATION]
        
        if len(attempt_data['attempts']) >= LOGIN_ATTEMPT_LIMIT:
            attempt_data['locked_until'] = now + LOGIN_LOCKOUT_DURATION
            return False, 'Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.'
    
    return True, None


def record_login_attempt(email, success=False):
    """Registra un intento de login"""
    now = time.time()
    
    if email not in login_attempts:
        login_attempts[email] = {'attempts': [], 'locked_until': None}
    
    if success:
        login_attempts[email] = {'attempts': [], 'locked_until': None}
    else:
        if 'attempts' not in login_attempts[email]:
            login_attempts[email]['attempts'] = []
        login_attempts[email]['attempts'].append(now)


@app.route('/api/verify-token', methods=['POST'])
def verify_token():
    """Verifica el token de Firebase y valida el dominio @unal.edu.co"""
    try:
        data = request.get_json()
        id_token = data.get('idToken')

        if not id_token:
            return jsonify({'error': 'Token no proporcionado'}), 400

        firebase_api_key = os.environ.get('FIREBASE_API_KEY')
        verify_url = f'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={firebase_api_key}'

        response = requests.post(verify_url, json={'idToken': id_token})

        if response.status_code != 200:
            return jsonify({'error': 'Token inválido'}), 401

        user_data = response.json()

        if 'users' not in user_data or len(user_data['users']) == 0:
            return jsonify({'error': 'Usuario no encontrado'}), 401

        user = user_data['users'][0]
        email = user.get('email', '')

        can_login, error_message = check_login_attempts(email)
        if not can_login:
            record_login_attempt(email, success=False)
            return jsonify({'error': error_message}), 429

        if not email.endswith('@unal.edu.co'):
            record_login_attempt(email, success=False)
            return jsonify({
                'error': 'Acceso denegado',
                'message': 'Solo se permiten correos con dominio @unal.edu.co'
            }), 403

        record_login_attempt(email, success=True)

        session['user_id'] = user.get('localId')
        session['email'] = email
        session['name'] = user.get('displayName', '')
        session['picture'] = user.get('photoUrl', '')

        return jsonify({
            'success': True,
            'user': {
                'uid': user.get('localId'),
                'email': email,
                'name': user.get('displayName', ''),
                'picture': user.get('photoUrl', '')
            }
        }), 200

    except requests.RequestException as e:
        print(f"❌ Error al conectar con Firebase: {str(e)}")
        return jsonify({'error': 'Error al verificar el token'}), 500
    except Exception as e:
        print(f"❌ Error al verificar token: {str(e)}")
        return jsonify({'error': 'Error al verificar el token'}), 500


@app.route('/api/logout', methods=['POST'])
def logout():
    """Cierra la sesión del usuario"""
    session.clear()
    return jsonify({'success': True}), 200


@app.route('/api/check-session', methods=['GET'])
def check_session_route():
    """Verifica si hay una sesión activa"""
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'user': {
                'email': session.get('email'),
                'name': session.get('name'),
                'picture': session.get('picture')
            }
        }), 200
    return jsonify({'authenticated': False}), 200


@app.route('/api/chat', methods=['POST'])
def chat():
    """Endpoint principal para el chat con IA usando Ollama + Scraping"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    
    if not firebase_initialized or db is None:
        return jsonify({'error': 'Firebase no está configurado'}), 503

    user_id = session['user_id']

    can_proceed, error_message = check_rate_limit(user_id, 'chat')
    if not can_proceed:
        return jsonify({'error': error_message}), 429

    try:
        data = request.get_json()
        user_message_text = data.get('message')
        conversation_id = data.get('conversationId')

        if not user_message_text or not conversation_id:
            return jsonify({'error': 'Falta el mensaje o el ID de la conversación'}), 400

        doc_ref = db.collection('conversations').document(conversation_id)
        doc = doc_ref.get()

        if not doc.exists:
            return jsonify({'error': 'Conversación no encontrada'}), 404

        conv_data = doc.to_dict()

        if not conv_data or conv_data.get('userId') != user_id:
            return jsonify({'error': 'Acceso no autorizado'}), 403

        scraped_data = detect_topic_and_scrape(user_message_text)
        
        enhanced_prompt = user_message_text
        if scraped_data:
            enhanced_prompt = f"""Pregunta del usuario: {user_message_text}

[Información actualizada extraída de sitios oficiales de la UNAL]
{scraped_data}

Responde basándote en la información proporcionada. Si es relevante, menciona las fuentes oficiales de la UNAL."""

        history = conv_data.get('messages', [])
        ollama_history = []
        for msg in history:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            ollama_history.append({'role': role, 'content': content})

        ollama_response = ask_ollama(enhanced_prompt, history=ollama_history)

        if not ollama_response.get('success'):
            return jsonify({
                'error': 'Error al procesar con Ollama',
                'details': ollama_response.get('error')
            }), 500

        assistant_message_text = ollama_response.get('content', '')

        current_messages = conv_data.get('messages', [])
        
        new_user_message = {'role': 'user', 'content': user_message_text}
        new_assistant_message = {'role': 'assistant', 'content': assistant_message_text}
        
        message_count = len(current_messages) + 2
        
        update_data = {
            'messages': firestore.ArrayUnion([new_user_message, new_assistant_message]),
            'updatedAt': firestore.SERVER_TIMESTAMP,
            'messageCount': message_count
        }
        
        if len(current_messages) == 0:
            title = user_message_text[:50] + ('...' if len(user_message_text) > 50 else '')
            update_data['title'] = title
        
        doc_ref.update(update_data)

        return jsonify({
            'success': True,
            'message': assistant_message_text,
            'scraped': bool(scraped_data)
        }), 200

    except requests.RequestException as e:
        print(f"❌ Error de conexión: {str(e)}")
        return jsonify({'error': 'Error de conexión'}), 500
    except Exception as e:
        print(f"❌ Error en /api/chat: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Verifica el estado del servidor y Ollama"""
    ollama_status = check_ollama_connection()
    
    return jsonify({
        'status': 'ok',
        'ollama_connected': ollama_status,
        'firebase_initialized': firebase_initialized
    }), 200


if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 Iniciando servidor Flask...")
    print("="*50)
    
    if check_ollama_connection():
        print("✅ Ollama está disponible")
    else:
        print("⚠️  Ollama no está disponible. Asegúrate de que esté ejecutándose.")
    
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
