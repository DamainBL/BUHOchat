class ChatViewModel {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.chatForm = document.getElementById('chat-form');
        this.chatInput = document.getElementById('chat-input');
        this.chatButton = this.chatForm?.querySelector('button');
        this.conversationsList = document.getElementById('conversations-list');
        this.newConversationBtn = document.getElementById('new-conversation-btn');
        this.currentConversationTitle = document.getElementById('current-conversation-title');
        this.chatSidebar = document.getElementById('chat-sidebar');

        this.currentConversationId = null;
        this.isProcessing = false;

        this.setupEventListeners();

        // CORRECCIÓN 1: Cargar conversaciones inmediatamente al iniciar
        this.loadConversations(); 
    }

    setupEventListeners() {
        if (this.chatForm) {
            this.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSendMessage();
            });
        }

        if (this.newConversationBtn) {
            this.newConversationBtn.addEventListener('click', () => this.createNewConversation());
        }
    }

    async createNewConversation() {
        try {
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Error al crear conversación');
            }

            const data = await response.json();
            this.currentConversationId = data.conversationId;

            this.clearChatDisplay();
            this.addBotMessage('¡Hola! ¿En qué puedo ayudarte hoy?');

            if (this.currentConversationTitle) {
                this.currentConversationTitle.textContent = 'Nueva conversación';
            }

            await this.loadConversations();

            if (window.innerWidth < 768 && this.chatSidebar) {
                this.chatSidebar.classList.remove('open');
            }
        } catch (error) {
            console.error('Error al crear conversación:', error);
            alert('Error al crear una nueva conversación');
        }
    }

    async loadConversations() {
        try {
            const response = await fetch('/api/conversations');

            if (!response.ok) {
                return;
            }

            const conversations = await response.json();
            this.displayConversations(conversations);
        } catch (error) {
            console.error('Error al cargar conversaciones:', error);
        }
    }

    displayConversations(conversations) {
        if (!this.conversationsList) return;

        this.conversationsList.innerHTML = '';

        if (conversations.length === 0) {
            this.conversationsList.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No hay conversaciones</p>';
            return;
        }

        conversations.forEach(conv => {
            const convItem = document.createElement('div');
            convItem.className = `conversation-item ${conv.id === this.currentConversationId ? 'active' : ''}`;
            convItem.innerHTML = `
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">${this.escapeHtml(conv.title)}</p>
                        <p class="text-xs text-gray-500">${conv.messageCount || 0} mensajes</p>
                    </div>
                    <button class="delete-btn text-red-500 hover:text-red-700 p-1" data-id="${conv.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            `;

            convItem.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn')) {
                    this.loadConversation(conv.id);
                }
            });

            const deleteBtn = convItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteConversation(conv.id);
            });

            this.conversationsList.appendChild(convItem);
        });
    }

    async loadConversation(convId) {
        try {
            const response = await fetch(`/api/conversations/${convId}`);

            if (!response.ok) {
                throw new Error('Error al cargar conversación');
            }

            const data = await response.json();
            this.currentConversationId = convId;

            this.clearChatDisplay();

            if (this.currentConversationTitle) {
                this.currentConversationTitle.textContent = data.title || 'Conversación';
            }

            const messages = data.messages || [];
            messages.forEach(msg => {
                if (msg.role === 'user') {
                    this.addUserMessage(msg.content, false);
                } else if (msg.role === 'assistant') {
                    this.addBotMessage(msg.content, false);
                }
            });

            await this.loadConversations();

            if (window.innerWidth < 768 && this.chatSidebar) {
                this.chatSidebar.classList.remove('open');
            }

            this.scrollToBottom();
        } catch (error) {
            console.error('Error al cargar conversación:', error);
            alert('Error al cargar la conversación');
        }
    }

    // CORRECCIÓN 2 PARTE A: Modificado para aceptar parámetro 'force' (sin preguntar)
    async deleteConversation(convId, force = false) {
        if (!force && !confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
            return;
        }

        try {
            const response = await fetch(`/api/conversations/${convId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Error al eliminar conversación');
            }

            if (this.currentConversationId === convId) {
                // Si borramos la actual (por error o voluntario), limpiamos la vista
                this.currentConversationId = null;
                this.clearChatDisplay();
                if (this.currentConversationTitle) {
                    this.currentConversationTitle.textContent = 'Nueva conversación';
                }
            }

            await this.loadConversations();

        } catch (error) {
            console.error('Error al eliminar conversación:', error);
            if (!force) alert('Error al eliminar la conversación');
        }
    }

    // CORRECCIÓN 2 PARTE B: Lógica para borrar si el bot falla
    async handleSendMessage() {
        if (this.isProcessing || !this.chatInput.value.trim()) {
            return;
        }

        const userMessage = this.chatInput.value.trim();
        this.chatInput.value = '';

        // Flag para saber si acabamos de crear esta conversación
        let isNewConversation = false;

        if (!this.currentConversationId) {
            await this.createNewConversation();
            isNewConversation = true;
        }

        this.addUserMessage(userMessage);
        this.showTypingIndicator();
        this.setProcessing(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    conversationId: this.currentConversationId
                })
            });

            this.hideTypingIndicator();

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al enviar mensaje');
            }

            const data = await response.json();
            this.addBotMessage(data.message);

            await this.loadConversations();
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            this.hideTypingIndicator();
            this.addBotMessage('Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.');

            // LÓGICA DE LIMPIEZA: Si era nueva y falló, la borramos
            if (isNewConversation && this.currentConversationId) {
                console.log("Borrando conversación vacía por error del bot...");
                await this.deleteConversation(this.currentConversationId, true); // true = force delete
            }

        } finally {
            this.setProcessing(false);
        }
    }

    addUserMessage(message, animate = true) {
        const userAvatar = window.userAvatarUrl || 'https://ui-avatars.com/api/?name=U&background=7b3238&color=fff';
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message-user ${animate ? 'message-animate' : ''}`;
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <p class="text-sm font-medium">${this.escapeHtml(message)}</p>
            </div>
            <img src="${userAvatar}" alt="User Avatar" class="chat-avatar">
        `;
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addBotMessage(message, animate = true) {
        if (typeof marked === 'undefined') {
            console.error("marked.js no está cargada. Usando fallback de texto plano.");
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = `chat-message-bot ${animate ? 'message-animate' : ''}`;
            fallbackDiv.innerHTML = `
                <img src="https://i.ibb.co/chwxgYhY/New-Project-1.png" alt="Bot Avatar" class="chat-avatar">
                <div class="message-bubble">
                    <p class="bot-name">BUHO</p>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
            this.chatContainer.appendChild(fallbackDiv);
            this.scrollToBottom();
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message-bot ${animate ? 'message-animate' : ''}`;

        const renderedHtml = marked.parse(message);

        messageDiv.innerHTML = `
            <img src="https://i.ibb.co/chwxgYhY/New-Project-1.png" alt="Bot Avatar" class="chat-avatar">
            <div class="message-bubble">
                <p class="bot-name">BUHO</p>
                <div class="markdown-content">${renderedHtml}</div>
            </div>
        `;
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'chat-message-bot';
        typingDiv.innerHTML = `
            <img src="https://i.ibb.co/chwxgYhY/New-Project-1.png" alt="Bot Avatar" class="chat-avatar">
            <div class="message-bubble">
                <div class="flex space-x-1.5 py-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot" style="animation-delay: -0.3s;"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot" style="animation-delay: -0.15s;"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot"></div>
                </div>
            </div>
        `;
        this.chatContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChatDisplay() {
        if (this.chatContainer) {
            this.chatContainer.innerHTML = '';
        }
    }

    clearChat() {
        this.currentConversationId = null;
        this.clearChatDisplay();
        if (this.conversationsList) {
            this.conversationsList.innerHTML = '';
        }
    }

    setProcessing(processing) {
        this.isProcessing = processing;
        if (this.chatInput) {
            this.chatInput.disabled = processing;
        }
        if (this.chatButton) {
            this.chatButton.disabled = processing;
        }
    }

    scrollToBottom() {
        if (this.chatContainer) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default ChatViewModel;