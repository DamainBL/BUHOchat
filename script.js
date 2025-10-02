document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const chatContainer = document.getElementById('chat-container');
    const sendButton = document.getElementById('send-button');
    const userInput = document.getElementById('user-input');
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // Historial de conversación para la API
    let chatHistory = [];
    
    // Constantes para la API de Gemini
    // const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=';
    const API_URL = 'AIzaSyAxhy-MoXMeGWg51uYPrqgKwaq-w3PFBHA';
    const apiKey = 'AIzaSyAxhy-MoXMeGWg51uYPrqgKwaq-w3PFBHA'; // El entorno de ejecución proporcionará la clave API

    // Oculta la pantalla de carga después de la animación
    setTimeout(() => {
        loader.style.display = 'none';
    }, 3500);
    
    // Función para detectar la preferencia de tema del sistema
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
    
    // Función para cambiar de tema manualmente
    function toggleTheme() {
        document.body.classList.toggle('light-mode');
        sunIcon.classList.toggle('hidden');
        moonIcon.classList.toggle('hidden');
    }

    // Detecta el tema inicial
    detectThemePreference();
    
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', handleKeyPress);
    themeToggle.addEventListener('click', toggleTheme);

    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

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

            const response = await fetch(API_URL + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error de la API: ${response.status}`);
            }

            const result = await response.json();
            
            // Extrae la respuesta del bot y la añade al chat y al historial
            const botResponse = result.candidates[0].content.parts[0].text;
            updateMessage(loadingMessage, botResponse);
            chatHistory.push({ role: 'model', parts: [{ text: botResponse }] });

        } catch (error) {
            console.error('Error al obtener la respuesta del bot:', error);
            updateMessage(loadingMessage, 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.');
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
        return messageBubble;
    }
    
    function updateMessage(messageElement, newText) {
        messageElement.innerText = newText;
    }

});
