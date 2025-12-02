# ![BUHO](https://i.ibb.co/RGwxnyLv/BUHO.png)

Aplicación web de chatbot para la Universidad Nacional de Colombia con autenticación de Google restringida a cuentas `@unal.edu.co`, interfaz de chat en tiempo real con IA, y gestión de perfil de usuario.

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.1+-green.svg)
![Firebase](https://img.shields.io/badge/Firebase-Admin-orange.svg)

---

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Python 3.11** o superior
- **pip** (gestor de paquetes de Python)
- **Git** (para clonar el repositorio)
- Una cuenta de **Firebase** con proyecto configurado

---

## Guía de Instalación Paso a Paso

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/DamainBL/BUHOchat.git
cd buho-chat-unal
```

### Paso 2: Crear Entorno Virtual (Recomendado)

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# En Windows:
venv\Scripts\activate

# En macOS/Linux:
source venv/bin/activate
```

### Paso 3: Instalar Dependencias

```bash
pip install -r requirements.txt
```

O si prefieres usar las dependencias del `pyproject.toml`:

```bash
pip install flask flask-cors python-dotenv requests beautifulsoup4 firebase-admin trafilatura
```

### Paso 4: Configurar Firebase

#### 4.1 Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita **Authentication** con el proveedor **Google**

#### 4.2 Obtener Credenciales del Cliente

1. En Firebase Console, ve a **Configuración del proyecto** (ícono de engranaje)
2. En la pestaña **General**, baja hasta "Tus apps"
3. Crea una nueva app web si no tienes una
4. Copia los valores de:
   - `apiKey`
   - `projectId`
   - `appId`

#### 4.3 Obtener Service Account Key

1. En Firebase Console, ve a **Configuración del proyecto**
2. Pestaña **Cuentas de servicio**
3. Click en **Generar nueva clave privada**
4. Guarda el archivo JSON descargado como `serviceAccountKey.json` en la raíz del proyecto

#### 4.4 Configurar Firestore

1. En Firebase Console, ve a **Firestore Database**
2. Click en **Crear base de datos**
3. Selecciona el modo **Producción** o **Prueba**
4. Elige una ubicación para tu base de datos

### Paso 5: Configurar Variables de Entorno

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus valores:

```env
SESSION_SECRET="your-session-secret-key-here"
FIREBASE_API_KEY="your-firebase-api-key"
FIREBASE_APP_ID="your-firebase-app-id"
FIREBASE_PROJECT_ID="your-firebase-project-id"
OLLAMA_URL="your-ngrok-url"
GROQ_API_KEY="your-GROQ-api-ke"
```

### Paso 6: Ejecutar la Aplicación

En una nueva terminal (con el entorno virtual activado):

```bash
python app.py
```

La aplicación estará disponible en: **http://localhost:5000**

---

## Estructura del Proyecto

```
buho-chat-unal/
├── app.py                    # Servidor Flask principal
├── templates/                # Plantillas HTML
│   ├── index.html           # Página principal con chat
│   └── account.html         # Página de perfil de usuario
├── static/                   # Archivos estáticos
│   ├── css/                 # Estilos
│   │   ├── main.css
│   │   └── chat.css
│   └── js/                  # JavaScript (ViewModels)
│       ├── auth.js          # Autenticación Firebase
│       ├── chat.js          # Lógica del chat
│       └── navigation.js    # Navegación
├── utils/                    # Utilidades del backend
│   ├── scraper.py           # Web scraping UNAL
│   └── ollama_client.py     # Cliente para Ollama
├── .env                      # Variables de entorno (no subir a git)
├── .env.example             # Ejemplo de variables de entorno
├── serviceAccountKey.json   # Credenciales Firebase (no subir a git)
├── requirements.txt         # Dependencias Python
└── README.md                # Este archivo
```

---

## Solución de Problemas

### Error: "Firebase credentials not found"

- Asegúrate de que `serviceAccountKey.json` esté en la raíz del proyecto
- Verifica que el archivo JSON sea válido

### Error: "Solo se permiten correos @unal.edu.co"

- Este es el comportamiento esperado
- Solo usuarios con correo institucional pueden acceder

### La página no carga estilos

- Limpia la caché del navegador (Ctrl+Shift+R)
- Verifica que Flask esté sirviendo archivos estáticos correctamente

---

## Seguridad

- Nunca subas `.env` o `serviceAccountKey.json` a repositorios públicos
- Agrega estos archivos a `.gitignore`:
  ```
  .env
  serviceAccountKey.json
  ```
- Usa contraseñas seguras para `SESSION_SECRET`
- Mantén las dependencias actualizadas

---

## Contribuir

1. Haz fork del repositorio
2. Crea una rama para tu feature: `git checkout -b mi-feature`
3. Commit tus cambios: `git commit -m 'Agregar mi feature'`
4. Push a la rama: `git push origin mi-feature`
5. Abre un Pull Request

