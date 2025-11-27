// Chatbot simple y gratuito
class SimpleChatbot {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    // Crear HTML del chatbot
    this.createChatbotHTML();
    this.attachEventListeners();
    this.addWelcomeMessage();
  }

  createChatbotHTML() {
    const chatbotHTML = `
      <div id="chatbot-container" class="chatbot-container">
        <div id="chatbot-window" class="chatbot-window hidden">
          <div class="chatbot-header">
            <div class="chatbot-header-content">
              <div class="chatbot-avatar">💬</div>
              <div>
                <h3 class="chatbot-title">Asistente Virtual</h3>
                <p class="chatbot-subtitle">Estamos aquí para ayudarte</p>
              </div>
            </div>
            <button id="chatbot-close" class="chatbot-close" aria-label="Cerrar chat">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 5L5 15M5 5l10 10"/>
              </svg>
            </button>
          </div>
          <div id="chatbot-messages" class="chatbot-messages"></div>
          <div class="chatbot-input-container">
            <input 
              type="text" 
              id="chatbot-input" 
              class="chatbot-input" 
              placeholder="Escribe tu mensaje..."
              autocomplete="off"
            />
            <button id="chatbot-send" class="chatbot-send" aria-label="Enviar mensaje">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
        <button id="chatbot-toggle" class="chatbot-toggle" aria-label="Abrir chat">
          <svg id="chatbot-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <svg id="chatbot-close-icon" class="hidden" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  }

  attachEventListeners() {
    const toggleBtn = document.getElementById('chatbot-toggle');
    const closeBtn = document.getElementById('chatbot-close');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');

    toggleBtn?.addEventListener('click', () => this.toggleChat());
    closeBtn?.addEventListener('click', () => this.closeChat());
    sendBtn?.addEventListener('click', () => this.sendMessage());
    
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    const window = document.getElementById('chatbot-window');
    const icon = document.getElementById('chatbot-icon');
    const closeIcon = document.getElementById('chatbot-close-icon');
    
    if (this.isOpen) {
      window?.classList.remove('hidden');
      icon?.classList.add('hidden');
      closeIcon?.classList.remove('hidden');
      document.getElementById('chatbot-input')?.focus();
    } else {
      this.closeChat();
    }
  }

  closeChat() {
    this.isOpen = false;
    const window = document.getElementById('chatbot-window');
    const icon = document.getElementById('chatbot-icon');
    const closeIcon = document.getElementById('chatbot-close-icon');
    
    window?.classList.add('hidden');
    icon?.classList.remove('hidden');
    closeIcon?.classList.add('hidden');
  }

  addWelcomeMessage() {
    this.addMessage('bot', '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?');
  }

  addMessage(sender, text) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message chatbot-message-${sender}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'chatbot-message-content';
    messageContent.textContent = text;
    
    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll al final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    this.messages.push({ sender, text, timestamp: new Date() });
  }

  sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input?.value.trim();
    
    if (!message) return;
    
    // Agregar mensaje del usuario
    this.addMessage('user', message);
    input.value = '';
    
    // Simular delay de respuesta
    setTimeout(() => {
      const response = this.getResponse(message);
      this.addMessage('bot', response);
    }, 500);
  }

  getResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Respuestas predefinidas - Fácil de personalizar
    const responses = {
      // Saludos
      'hola': '¡Hola! ¿En qué puedo ayudarte?',
      'buenos días': '¡Buenos días! ¿Cómo puedo asistirte?',
      'buenas tardes': '¡Buenas tardes! Estoy aquí para ayudarte.',
      'buenas noches': '¡Buenas noches! ¿En qué puedo ayudarte?',
      
      // Información general
      'inscripción': 'Para inscribirte, puedes visitar la sección de "Inscripción" en el menú principal o hacer clic en el botón correspondiente. ¿Necesitas más información?',
      'reinscripción': 'Para reinscribirte, puedes acceder a la sección de "Reinscripción" desde el menú principal. ¿Tienes alguna pregunta específica?',
      'carreras': 'Ofrecemos las siguientes carreras: Preparación de Alimentos y Bebidas, Ventas, Programación, y Gestión e Innovación Turística. ¿Te interesa alguna en particular?',
      'contacto': 'Puedes contactarnos en: Avenida arco norte entre avenida isla saona y calle isla magdalena. Tel: 9983213282. Correo: cbtis272.dir@dgeti.sems.gob.mx',
      'teléfono': 'Nuestro teléfono es: 9983213282',
      'correo': 'Nuestro correo electrónico es: cbtis272.dir@dgeti.sems.gob.mx',
      'dirección': 'Estamos ubicados en: Avenida arco norte entre avenida isla saona y calle isla magdalena',
      
      // Ayuda
      'ayuda': 'Puedo ayudarte con información sobre inscripciones, reinscripciones, carreras, contacto y más. ¿Qué necesitas saber?',
      'información': 'Puedo proporcionarte información sobre inscripciones, reinscripciones, carreras y datos de contacto. ¿Qué te interesa?',
      
      // Despedidas
      'gracias': '¡De nada! Si necesitas algo más, no dudes en preguntar. 😊',
      'adiós': '¡Hasta luego! Que tengas un excelente día.',
      'chao': '¡Hasta pronto! Estoy aquí cuando me necesites.',
    };
    
    // Buscar respuesta exacta
    if (responses[message]) {
      return responses[message];
    }
    
    // Buscar palabras clave
    for (const [key, response] of Object.entries(responses)) {
      if (message.includes(key)) {
        return response;
      }
    }
    
    // Respuesta por defecto
    const defaultResponses = [
      'Entiendo tu pregunta. Te recomiendo contactarnos directamente para obtener información más específica. ¿Hay algo más en lo que pueda ayudarte?',
      'Gracias por tu consulta. Puedo ayudarte con información sobre inscripciones, reinscripciones, carreras o contacto. ¿Qué te interesa?',
      'No estoy seguro de cómo responder eso específicamente. ¿Podrías reformular tu pregunta? Puedo ayudarte con información sobre inscripciones, carreras o contacto.',
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }
}

// Inicializar chatbot cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new SimpleChatbot();
});

