document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const chatApp = document.getElementById('chat-app');
    const apiKeyPrompt = document.getElementById('api-key-prompt');
    const apiKeyInput = document.getElementById('api-key-input');
    const submitKeyButton = document.getElementById('submit-key-button');
    
    const chatContainer = document.getElementById('chat-container');
    const sendButton = document.getElementById('send-button');
    const userInput = document.getElementById('user-input');
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // Nuevos botones de funcionalidad
    const summarizeButton = document.getElementById('summarize-button');
    const formalizeButton = document.getElementById('formalize-button');

    // Variable global para almacenar la API Key
    let currentApiKey = null;
    let chatHistory = [];
    // Modelo por defecto: 'gemma-3n-e4b-it'
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-3n-e4b-it:generateContent?key=';

    // --- Funciones de Interfaz y Tema ---

    function detectThemePreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.body.classList.add('light-mode');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            document.body.classList.remove('light-mode');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    }
    
    function toggleTheme() {
        document.body.classList.toggle('light-mode');
        sunIcon.classList.toggle('hidden');
        moonIcon.classList.toggle('hidden');
    }

    // --- Lógica de API Key y App State ---

    function loadApp() {
        apiKeyPrompt.classList.remove('hidden');
        chatApp.classList.add('hidden');
    }

    function showChatInterface() {
        apiKeyPrompt.classList.add('hidden');
        chatApp.classList.remove('hidden');
        userInput.focus();
    }

    function submitApiKey() {
        const key = apiKeyInput.value.trim();
        if (key.length > 0) {
            currentApiKey = key;
            showChatInterface();
        } else {
            // Sustitución de alert() por mensaje visual en el futuro
            alert('Por favor, ingresa una clave de API válida.');
        }
    }

    // --- Funciones de API LLM (incluye lógica de reintentos) ---

    /**
     * Función para realizar llamadas a la API con reintentos (backoff exponencial).
     */
    async function fetchWithRetry(url, options, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return response;
                }
                // Lanzar error para reintentar si el estado no es 2xx
                throw new Error(`HTTP error! status: ${response.status}`);
            } catch (error) {
                if (i < retries - 1) {
                    const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s de retardo
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; // Lanzar el error final si se agotan los reintentos
                }
            }
        }
    }

    // --- Funcionalidades LLM ---

    async function summarizeChat() {
        if (!currentApiKey || chatHistory.length === 0) {
            alert('Inicia una conversación para poder resumirla.');
            return;
        }

        // Concatenar el historial para enviarlo al modelo
        let fullConversation = chatHistory.map(
            msg => `${msg.role === 'user' ? 'Tú' : 'Asistente'}: ${msg.parts[0].text}`
        ).join('\n');


        const systemPrompt = "Eres un asistente de resumen profesional. Analiza el siguiente historial de chat y devuelve un resumen conciso de los puntos clave y los temas discutidos. El resumen debe ser de no más de 100 palabras.";
        const userQuery = `Por favor, resume la siguiente conversación para mi:\n\n${fullConversation}`;
        
        const loadingMessage = appendMessage('✨ Generando resumen...', 'bot', true);
        
        try {
            const payload = {
                contents: [{ role: 'user', parts: [{ text: userQuery }] }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            const response = await fetchWithRetry(API_URL + currentApiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const summary = result.candidates[0].content.parts[0].text;
            
            const finalResponse = `**✨ Resumen Generado:**\n\n${summary}`;
            updateMessage(loadingMessage, finalResponse);

        } catch (error) {
            console.error('Error al generar resumen:', error);
            updateMessage(loadingMessage, 'Lo siento, no pude generar el resumen. Hubo un problema con la API.');
        }
    }


    async function formalizeLastMessage() {
        // Encuentra el último mensaje enviado por el usuario
        const lastUserMessage = chatHistory.slice().reverse().find(msg => msg.role === 'user');

        if (!currentApiKey || !lastUserMessage) {
            alert('Debes enviar al menos un mensaje para poder formalizarlo.');
            return;
        }

        const originalText = lastUserMessage.parts[0].text;
        const systemPrompt = `Tu tarea es tomar el siguiente texto y reescribirlo para que su tono sea mucho más formal, profesional y educado. Solo devuelve el texto reescrito. Texto a formalizar: "${originalText}"`;
        
        const loadingMessage = appendMessage('✨ Formalizando mensaje...', 'bot', true);
        
        try {
            const payload = {
                contents: [{ role: 'user', parts: [{ text: 'Reescribe mi mensaje anterior con un tono formal.' }] }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            const response = await fetchWithRetry(API_URL + currentApiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const formalizedText = result.candidates[0].content.parts[0].text;
            
            const finalResponse = `**✨ Versión Formal:**\n\n**Original:** *${originalText}*\n**Formalizado:** ${formalizedText}`;
            updateMessage(loadingMessage, finalResponse);

        } catch (error) {
            console.error('Error al formalizar el mensaje:', error);
            updateMessage(loadingMessage, 'Lo siento, no pude formalizar el mensaje. Hubo un problema con la API.');
        }
    }


    // --- Lógica de Chat Principal ---

    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;
        
        if (!currentApiKey) {
            alert('Error: La clave de API de Gemini no está configurada.');
            return;
        }

        // Añade el mensaje del usuario al chat y al historial
        appendMessage(message, 'user');
        chatHistory.push({ role: 'user', parts: [{ text: message }] });
        userInput.value = '';

        // Muestra un mensaje de carga del bot
        const loadingMessage = appendMessage('...', 'bot', true);

        try {
            // Crea el payload de la solicitud con el historial de chat completo
            const payload = {
                contents: chatHistory,
            };

            // Usa la API Key proporcionada por el usuario
            const response = await fetchWithRetry(API_URL + currentApiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Si se llega aquí, la respuesta fue exitosa después de los reintentos
            const result = await response.json();
            
            // Extrae la respuesta del bot y la añade al chat y al historial
            const botResponse = result.candidates[0].content.parts[0].text;
            updateMessage(loadingMessage, botResponse);
            chatHistory.push({ role: 'model', parts: [{ text: botResponse }] });

        } catch (error) {
            console.error('Error al obtener la respuesta del bot:', error);
            updateMessage(loadingMessage, 'Lo siento, ha ocurrido un error. Hubo un problema con la API. Verifica tu clave.');
        }
    }

    function appendMessage(message, sender, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('flex', 'items-end', 'space-x-2', 'chat-message');
        
        if (sender === 'user') {
            messageDiv.classList.add('user');
        } else {
            messageDiv.classList.add('bot');
        }

        const profilePic = document.createElement('img');
        profilePic.classList.add('w-12', 'h-12', 'rounded-full', 'object-cover', 'flex-shrink-0');
        if (sender === 'user') {
            profilePic.src = "https://placehold.co/100x100/A0AEC0/FFFFFF?text=Yo";
            profilePic.alt = "Tu Perfil";
        } else {
            profilePic.src = "https://i.ibb.co/chwxgYhY/New-Project-1.png";
            profilePic.alt = "Perfil del Bot";
        }

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', 'p-4', 'rounded-lg', 'max-w-xs', 'shadow');
        
        // Usar innerText para mensajes normales para evitar XSS
        messageBubble.innerText = message;
        
        if (sender === 'user') {
            messageDiv.appendChild(messageBubble);
            messageDiv.appendChild(profilePic);
        } else {
            messageDiv.appendChild(profilePic);
            messageDiv.appendChild(messageBubble);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return messageBubble; // Devuelve el elemento para poder actualizarlo
    }
    
    function updateMessage(messageElement, newText) {
        // Esta función se encarga de aplicar formato HTML básico (como negritas y saltos de línea)
        // solo para las respuestas de las nuevas funcionalidades LLM.
        if (newText.includes('**✨')) {
             const formattedText = newText
                 // Reemplazar negritas Markdown (**) por <strong>
                 .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                 // Reemplazar cursivas Markdown (*) por <em>
                 .replace(/\*(.*?)\*/g, '<em>$1</em>')
                 // Reemplazar saltos de línea por <br>
                 .replace(/\n/g, '<br>');
             messageElement.innerHTML = formattedText;
        } else {
            // Para respuestas de chat normales, usamos innerText
            messageElement.innerText = newText;
        }
    }

    // --- Inicialización ---

    detectThemePreference();
    
    // Oculta la pantalla de carga y muestra el prompt de API Key
    setTimeout(() => {
        loader.style.display = 'none';
        loadApp();
    }, 3500);

    // Event Listeners
    submitKeyButton.addEventListener('click', submitApiKey);
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitApiKey();
    });

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', handleKeyPress);
    themeToggle.addEventListener('click', toggleTheme);

    // Event Listeners para las nuevas funcionalidades LLM
    summarizeButton.addEventListener('click', summarizeChat);
    formalizeButton.addEventListener('click', formalizeLastMessage);
});
