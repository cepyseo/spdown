// ===============================
// SABITLER VE KONFIGÜRASYON
// ===============================

// LocalStorage anahtarları
const STORAGE_KEY = 'ai_hub_chat_history';
const THEME_KEY = 'ai_hub_theme';
const CONVERSATIONS_KEY = 'ai_hub_conversations';
const CURRENT_CONVERSATION_KEY = 'ai_hub_current_conversation';
const MAX_HISTORY_LENGTH = 50; // Maksimum saklanacak mesaj sayısı
const MAX_CONVERSATIONS = 20; // Maksimum saklanacak konuşma sayısı
const MAX_CONTEXT_MESSAGES = 15; // API'ye gönderilecek maksimum mesaj sayısı

// API URL - Doğrudan DeepSeek API'sine bağlanıyoruz
const API_URL = 'https://deepseek-r1.istebutolga.workers.dev/';
const AI_NAME = 'CepyX';

// Konuşma bağlamı için maksimum kelime sayısı
const MAX_CONTEXT_WORDS = 1000;

/**
 * Konuşma bağlamını hazırlar ve optimize eder
 * @param {Array} history - Konuşma geçmişi
 * @returns {Array} - Optimize edilmiş bağlam
 */
function prepareConversationContext(history) {
    if (!history || history.length === 0) return [];
    
    // Son mesajları önceliklendir
    let context = [...history];
    const currentTheme = identifyMainTheme(context);
    
    // Mesajları puanla
    context = context.map((msg, index) => ({
        ...msg,
        score: calculateMessageScore(msg, index, context.length, currentTheme)
    }));
    
    // Puanlarına göre sırala ve en önemlileri seç
    context.sort((a, b) => b.score - a.score);
    
    // Bağlamı optimize et
    let wordCount = 0;
    const optimizedContext = [];
    
    for (const msg of context) {
        const words = msg.content.split(/\s+/).length;
        if (wordCount + words <= MAX_CONTEXT_WORDS) {
            optimizedContext.push({
                role: msg.role,
                content: msg.content
            });
            wordCount += words;
        }
    }
    
    // Kronolojik sıraya geri döndür
    return optimizedContext.sort((a, b) => 
        history.indexOf(history.find(m => m.content === a.content)) -
        history.indexOf(history.find(m => m.content === b.content))
    );
}

/**
 * Mesaj önem puanını hesaplar
 * @param {Object} msg - Mesaj objesi
 * @param {number} index - Mesajın geçmişteki indeksi
 * @param {number} totalMessages - Toplam mesaj sayısı
 * @param {string} currentTheme - Mevcut konuşma teması
 * @returns {number} - Mesajın önem puanı
 */
function calculateMessageScore(msg, index, totalMessages, currentTheme) {
    let score = 0;
    
    // Yenilik puanı (son mesajlar daha önemli)
    score += (index / totalMessages) * 10;
    
    // Tema uyumu
    if (msg.theme === currentTheme) {
        score += 5;
    }
    
    // İçerik uzunluğu (çok kısa veya çok uzun mesajları dengele)
    const wordCount = msg.content.split(/\s+/).length;
    if (wordCount >= 10 && wordCount <= 100) {
        score += 3;
    }
    
    // Kod içeriği varsa ekstra puan
    if (msg.content.includes('```')) {
        score += 4;
    }
    
    return score;
}

// NOT: Bu özelliğin çalışması için worker dosyasında aşağıdaki değişiklikleri yapmanız gerekir:
// 1. API yanıtını stream olarak işleyin
// 2. Düşünme sürecini "thinking" alanında gönderin
// 3. Final yanıtı "response" alanında gönderin
// Örnek worker kodu:
/*
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const prompt = url.searchParams.get('prompt');
  const contextParam = url.searchParams.get('context');
  
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Prompt parametresi gerekli' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  let context = [];
  try {
    if (contextParam) {
      context = JSON.parse(contextParam);
    }
  } catch (e) {
    console.error('Context parse hatası:', e);
  }
  
  // Stream yanıtı için
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // API isteğini başlat
  fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        ...context.map(msg => ({ role: msg.role, content: msg.content })),
        { role: "user", content: prompt }
      ],
      stream: true
    })
  })
  .then(async response => {
    if (!response.ok) {
      throw new Error(`API yanıt vermedi: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    let thinking = "Düşünüyorum...";
    let responseText = "";
    
    // Düşünme sürecini gönder
    const sendThinking = async () => {
      await writer.write(
        new TextEncoder().encode(
          JSON.stringify({ thinking })
        )
      );
    };
    
    // İlk düşünme mesajını gönder
    await sendThinking();
    
    // Düşünme sürecini periyodik olarak güncelle
    const thinkingInterval = setInterval(async () => {
      thinking += ".";
      await sendThinking();
    }, 1000);
    
    // Yanıtı parça parça oku
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      responseText += chunk;
      
      // Düşünme sürecini güncelle
      thinking = `Yanıt hazırlanıyor: ${responseText.substring(0, 100)}...`;
    }
    
    // Düşünme sürecini durdur
    clearInterval(thinkingInterval);
    
    // Final yanıtı gönder
    await writer.write(
      new TextEncoder().encode(
        JSON.stringify({ response: responseText })
      )
    );
    
    await writer.close();
  })
  .catch(async error => {
    console.error('API Hatası:', error);
    await writer.write(
      new TextEncoder().encode(
        JSON.stringify({ error: error.message })
      )
    );
    await writer.close();
  });
  
  return new Response(readable, {
    headers: { 'Content-Type': 'application/json' }
  });
}
*/

// Markdown yapılandırması
marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true,
    mangle: false
});

// ===============================
// DOM ELEMENTLERI
// ===============================
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');
const loaderContainer = document.querySelector('.loader-container');
const content = document.querySelector('.content');
const darkThemeBtn = document.getElementById('darkTheme');
const lightThemeBtn = document.getElementById('lightTheme');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsList = document.getElementById('conversationsList');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const sidebar = document.querySelector('.sidebar');

// ===============================
// TEMA YÖNETIMI
// ===============================

/**
 * Temayı ayarlar ve buton durumlarını günceller
 * @param {string} theme - 'dark' veya 'light'
 */
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    
    // Buton durumlarını güncelle
    if (theme === 'dark') {
        darkThemeBtn.classList.add('active');
        lightThemeBtn.classList.remove('active');
    } else {
        darkThemeBtn.classList.remove('active');
        lightThemeBtn.classList.add('active');
    }
}

// Kaydedilmiş temayı yükle
const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
setTheme(savedTheme);

// ===============================
// SOHBET YÖNETIMI
// ===============================

// Sohbet geçmişini ve konuşmaları yükle
let chatHistory = [];
let conversations = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '{}');
let currentConversationId = localStorage.getItem(CURRENT_CONVERSATION_KEY) || null;

// ===============================
// TEST MESAJLARI
// ===============================

/**
 * Test mesajlarını yükler
 */
function loadTestMessages() {
    const testMessages = [
        {
            role: 'user',
            content: 'Merhaba! Nasılsın?'
        },
        {
            role: 'assistant',
            content: `# Merhaba! Hoş geldiniz!

Ben çok iyiyim, teşekkür ederim. Size nasıl yardımcı olabilirim?

## İşte yapabileceğim bazı şeyler:

1. **Programlama** konularında yardım
2. **Matematik** problemlerini çözme
3. **Türkçe** metin yazma ve düzenleme
4. **İngilizce** çeviri yapma
5. **Veri analizi** konusunda bilgi verme

### Kod örnekleri de gösterebilirim:

\`\`\`python
def merhaba_dünya():
    print("Merhaba Dünya!")
    
    # Türkçe karakterler: ğüşıöçĞÜŞİÖÇ
    print("Türkçe karakterler destekleniyor")
    
merhaba_dünya()
\`\`\`

### Tablolar oluşturabilirim:

| Türkçe | İngilizce |
|--------|-----------|
| Merhaba | Hello |
| Nasılsın | How are you |
| İyi günler | Good day |
| Teşekkür ederim | Thank you |

> **Not:** Türkçe karakterleri doğru şekilde göstermeye özen gösteriyorum: ğüşıöçĞÜŞİÖÇ

Başka nasıl yardımcı olabilirim?`
        }
    ];
    
    // Test mesajlarını ekle
    testMessages.forEach(message => {
        appendMessage(message.role, message.content, false);
    });

    // Test mesajlarını geçmişe ekle
    chatHistory = testMessages;
    
    // Yeni konuşma oluştur
    createNewConversation('Hoş Geldiniz');
}

// ===============================
// TEMA YÖNETIMI
// ===============================

// Sayfa yüklendiğinde mevcut konuşmayı yükle
window.addEventListener('DOMContentLoaded', () => {
    // Mevcut konuşmayı yükle
    if (currentConversationId && conversations[currentConversationId]) {
        loadConversation(currentConversationId);
    } else if (Object.keys(conversations).length > 0) {
        // Eğer mevcut konuşma yoksa ama kaydedilmiş konuşmalar varsa, en son konuşmayı yükle
        const sortedConversations = Object.values(conversations).sort((a, b) => {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        
        if (sortedConversations.length > 0) {
            loadConversation(sortedConversations[0].id);
        } else {
            // Test mesajları ekle (eğer hiç konuşma yoksa)
            loadTestMessages();
        }
    } else {
        // Test mesajları ekle (eğer hiç konuşma yoksa)
        loadTestMessages();
    }
    
    // Konuşma listesini güncelle
    updateConversationsList();
    
    // Tema değiştirme butonlarının olduğu div'e ekle
    const themeSwitcher = document.querySelector('.theme-switcher');
    if (themeSwitcher) {
        
        // Stil düzenlemeleri
        themeSwitcher.style.flexWrap = 'wrap';
        themeSwitcher.style.gap = '8px';
        const themeButtons = themeSwitcher.querySelectorAll('.theme-btn');
        themeButtons.forEach(btn => {
            btn.style.flex = '1 0 calc(50% - 4px)';
        });
    }
    
    // Yükleme ekranını gizle
    setTimeout(() => {
        loaderContainer.style.opacity = '0';
        setTimeout(() => {
            loaderContainer.style.display = 'none';
            content.style.opacity = '1';
        }, 500);
    }, 1000);
});

/**
 * Yeni bir konuşma oluşturur
 * @param {string} title - Konuşma başlığı (opsiyonel)
 * @returns {string} - Oluşturulan konuşma ID'si
 */
function createNewConversation(title = null) {
    const conversationId = 'conv-' + Date.now();
    const timestamp = new Date().toISOString();
    
    // İlk mesajdan başlık oluştur
    if (!title && chatHistory.length > 0 && chatHistory[0].role === 'user') {
        // İlk kullanıcı mesajını başlık olarak kullan (maksimum 30 karakter)
        title = chatHistory[0].content.substring(0, 30);
        if (chatHistory[0].content.length > 30) {
            title += '...';
        }
    } else if (!title) {
        title = 'Yeni Konuşma';
    }
    
    conversations[conversationId] = {
        id: conversationId,
        title: title,
        messages: [...chatHistory],
        createdAt: timestamp,
        updatedAt: timestamp
    };
    
    // Konuşma sayısını kontrol et ve eski konuşmaları temizle
    cleanupOldConversations();
    
    // LocalStorage'a kaydet
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    
    // Mevcut konuşma olarak ayarla
    currentConversationId = conversationId;
    localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
    
    // Konuşma listesini güncelle
    updateConversationsList();
    
    return conversationId;
}

/**
 * Eski konuşmaları temizler
 */
function cleanupOldConversations() {
    const conversationIds = Object.keys(conversations);
    
    if (conversationIds.length > MAX_CONVERSATIONS) {
        // Konuşmaları tarihe göre sırala (en eski en başta)
        const sortedConversations = Object.values(conversations).sort((a, b) => {
            return new Date(a.updatedAt) - new Date(b.updatedAt);
        });
        
        // En eski konuşmaları sil
        const conversationsToRemove = sortedConversations.slice(0, conversationIds.length - MAX_CONVERSATIONS);
        conversationsToRemove.forEach(conv => {
            delete conversations[conv.id];
        });
        
        console.log(`${conversationsToRemove.length} eski konuşma temizlendi.`);
    }
}

/**
 * Belirli bir konuşmayı yükler
 * @param {string} conversationId - Yüklenecek konuşma ID'si
 */
function loadConversation(conversationId) {
    if (conversations[conversationId]) {
        // Mevcut konuşmayı güncelle
        if (currentConversationId && chatHistory.length > 0) {
            conversations[currentConversationId].messages = [...chatHistory];
            conversations[currentConversationId].updatedAt = new Date().toISOString();
            localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
        }
        
        // Yeni konuşmayı yükle
        currentConversationId = conversationId;
        localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
        chatHistory = [...conversations[conversationId].messages];
        
        // Mesajları göster
        chatMessages.innerHTML = '';
        chatHistory.forEach(message => {
            appendMessage(message.role, message.content, false);
        });
        
        // Konuşma listesini güncelle
        updateConversationsList();
        
        // Mesaj alanını en alta kaydır
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }
}

/**
 * Konuşma listesini günceller
 */
function updateConversationsList() {
    if (!conversationsList) return;
    
    // Listeyi temizle
    conversationsList.innerHTML = '';
    
    // Konuşmaları tarihe göre sırala (en yeni en üstte)
    const sortedConversations = Object.values(conversations).sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    
    // Konuşmaları listele
    sortedConversations.forEach(conversation => {
        const conversationItem = document.createElement('div');
        conversationItem.className = `conversation-item${conversation.id === currentConversationId ? ' active' : ''}`;
        conversationItem.dataset.id = conversation.id;
        
        // Tarih formatı
        const date = new Date(conversation.updatedAt);
        const formattedDate = `${date.toLocaleDateString()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        conversationItem.innerHTML = `
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-date">${formattedDate}</div>
            <button class="delete-conversation" data-id="${conversation.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;
        
        // Konuşma tıklama olayı
        conversationItem.addEventListener('click', (e) => {
            // Silme butonuna tıklandıysa, konuşmayı silme
            if (e.target.closest('.delete-conversation')) {
                e.stopPropagation();
                const id = e.target.closest('.delete-conversation').dataset.id;
                deleteConversation(id);
                return;
            }
            
            loadConversation(conversation.id);
        });
        
        conversationsList.appendChild(conversationItem);
    });
}

/**
 * Konuşmayı siler
 * @param {string} conversationId - Silinecek konuşma ID'si
 */
function deleteConversation(conversationId) {
    if (conversations[conversationId]) {
        // Konuşmayı sil
        delete conversations[conversationId];
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
        
        // Eğer mevcut konuşma silindiyse, yeni bir konuşma oluştur
        if (conversationId === currentConversationId) {
            chatHistory = [];
            chatMessages.innerHTML = '';
            currentConversationId = null;
            localStorage.removeItem(CURRENT_CONVERSATION_KEY);
        }
        
        // Konuşma listesini güncelle
        updateConversationsList();
    }
}

/**
 * Mevcut konuşmayı günceller
 */
function updateCurrentConversation() {
    if (currentConversationId && conversations[currentConversationId]) {
        conversations[currentConversationId].messages = [...chatHistory];
        conversations[currentConversationId].updatedAt = new Date().toISOString();
        
        // İlk mesajdan başlık güncelleme
        if (chatHistory.length > 0 && chatHistory[0].role === 'user') {
            let title = chatHistory[0].content.substring(0, 30);
            if (chatHistory[0].content.length > 30) {
                title += '...';
            }
            conversations[currentConversationId].title = title;
        }
        
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
        updateConversationsList();
    } else if (chatHistory.length > 0) {
        // Eğer mevcut konuşma yoksa ve mesaj varsa, yeni konuşma oluştur
        createNewConversation();
    }
}

/**
 * Mesaj ekleme fonksiyonu
 * @param {string} role - 'user' veya 'assistant'
 * @param {string} content - Mesaj içeriği
 * @param {boolean} isThinking - Düşünme animasyonu gösterilecek mi
 * @returns {string} - Oluşturulan mesaj elementi ID'si
 */
function appendMessage(role, content, isThinking = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}${isThinking ? ' thinking' : ''}`;
    
    // Mesaj zamanını ve meta verilerini ekle
    const timestamp = new Date().toISOString();
    const messageId = 'msg-' + Date.now();
    const theme = identifyMainTheme(chatHistory);
    
    // AI adını güncelle
    if (role === 'assistant' && !content.startsWith('# ' + AI_NAME)) {
        content = content.replace(/^# .*?\n/, `# ${AI_NAME}\n`);
        content = content.replace(/^Üzgünüm/g, `${AI_NAME} üzgün`);
    }
    
    // Mesaj başlığını oluştur
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    headerDiv.innerHTML = `
        <span class="message-role">${role === 'assistant' ? AI_NAME : 'Sen'}</span>
        <span class="message-time">${new Date(timestamp).toLocaleTimeString()}</span>
        ${theme ? `<span class="message-theme">${theme}</span>` : ''}
    `;
    messageDiv.appendChild(headerDiv);
    
    if (content.includes('<think>')) {
        // Düşünme içeriğini işle
        const thinkingContent = content.match(/<think>([\s\S]*?)<\/think>/);
        const mainContent = content.replace(/<think>[\s\S]*?<\/think>\n?\n?/g, '');
        
        if (thinkingContent && thinkingContent[1]) {
            // Düşünme içeriğini göster
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'thinking-process';
            thinkingDiv.innerHTML = `<em class="thinking-text">${thinkingContent[1]}</em>`;
            
            // Düşünme içeriğini gizle/göster butonu
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-thinking-btn';
            toggleButton.textContent = 'Düşünme sürecini göster';
            toggleButton.addEventListener('click', function() {
                const isVisible = thinkingDiv.style.display !== 'none';
                thinkingDiv.style.display = isVisible ? 'none' : 'block';
                this.textContent = isVisible ? 'Düşünme sürecini göster' : 'Düşünme sürecini gizle';
            });
            
            // Düşünme içeriğini varsayılan olarak gizle
            thinkingDiv.style.display = 'none';
            
            // Ana içeriği işle
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            if (role === 'assistant') {
                // Markdown'ı HTML'e çevir ve güvenli şekilde işle
                try {
                    // Markdown içeriğini düzenle
                    let processedContent = preprocessMarkdown(mainContent);
                    
                    // Markdown'ı HTML'e çevir
                    const rawHtml = marked.parse(processedContent);
                    
                    // DOMPurify ile XSS koruması uygula
                    const cleanHtml = DOMPurify.sanitize(rawHtml, {
                        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'strong', 'em', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br'],
                        ALLOWED_ATTR: ['href', 'class', 'id', 'target']
                    });
                    
                    contentDiv.innerHTML = cleanHtml;
                    
                    // Markdown elementlerini işle
                    processMarkdownElements(contentDiv);
                    
                } catch (error) {
                    console.error('Markdown işleme hatası:', error);
                    contentDiv.textContent = mainContent;
                }
            } else {
                contentDiv.textContent = mainContent;
            }
            
            // Elementleri mesaj div'ine ekle
            messageDiv.appendChild(toggleButton);
            messageDiv.appendChild(thinkingDiv);
            messageDiv.appendChild(contentDiv);
        } else {
            // Düşünme içeriği yoksa normal işle
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = content.replace(/<think>(.*?)<\/think>/g, '<em class="thinking-text">$1</em>');
            messageDiv.appendChild(contentDiv);
        }
    } else if (role === 'assistant' && !isThinking) {
        // Markdown'ı HTML'e çevir
        try {
            // Markdown içeriğini düzenle
            let processedContent = preprocessMarkdown(content);
            
            // Markdown'ı HTML'e çevir
            const rawHtml = marked.parse(processedContent);
            
            // XSS koruması için DOMPurify kullan
            const cleanHtml = DOMPurify.sanitize(rawHtml);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = cleanHtml;
            
            // Markdown elementlerini işle
            processMarkdownElements(contentDiv);
            
            messageDiv.appendChild(contentDiv);
        } catch (error) {
            console.error('Markdown işleme hatası:', error);
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = content;
            messageDiv.appendChild(contentDiv);
        }
    } else {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        messageDiv.appendChild(contentDiv);
    }
    
    // Meta verileri ekle
    messageDiv.dataset.id = messageId;
    messageDiv.dataset.timestamp = timestamp;
    messageDiv.dataset.theme = theme;
    
    chatMessages.appendChild(messageDiv);
    
    // Otomatik scroll (yumuşak geçiş ile)
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
    
    // Mobil cihazlarda yeni mesaj geldiğinde sayfayı aşağı kaydır
    if (window.innerWidth <= 768) {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }
    
    // Mesajı geçmişe ekle
    if (!isThinking) {
        const messageObj = {
            id: messageId,
            role,
            content,
            timestamp,
            theme
        };
        
        chatHistory.push(messageObj);
        
        // Geçmiş sınırını kontrol et ve en eski mesajları kaldır
        if (chatHistory.length > MAX_HISTORY_LENGTH) {
            // Önemli bağlamı korumak için ilk mesajı tut
            const firstMessage = chatHistory[0];
            chatHistory = [firstMessage, ...chatHistory.slice(-(MAX_HISTORY_LENGTH - 1))];
        }
        
        // Mevcut konuşmayı güncelle
        updateCurrentConversation();
        
        // Konuşma temasını güncelle
        if (role === 'user') {
            document.dispatchEvent(new CustomEvent('themeUpdate', { 
                detail: { 
                    theme,
                    messageId,
                    timestamp 
                }
            }));
        }
    }
    
    return messageId;
}

/**
 * Markdown elementlerini işler (kod blokları, bağlantılar, tablolar vb.)
 * @param {HTMLElement} container - İşlenecek HTML container elementi
 */
function processMarkdownElements(container) {
            // Kod bloklarını renklendir
    container.querySelectorAll('pre code').forEach((block) => {
                // Dil sınıfını kontrol et
                const langClass = Array.from(block.classList).find(cl => cl.startsWith('language-'));
                if (langClass) {
                    const lang = langClass.replace('language-', '');
                    if (hljs.getLanguage(lang)) {
                        hljs.highlightElement(block);
                    }
                } else {
                    hljs.highlightElement(block);
                }
        
        // Kod bloklarına copy butonu ekle
        addCopyButtonToCodeBlock(block);
            });

            // Bağlantıları yeni sekmede aç
    container.querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });
    
    // Tabloları düzgün görüntüle
    container.querySelectorAll('table').forEach(table => {
        // Eğer tablo zaten bir wrapper içinde değilse
        if (!table.parentNode.classList.contains('markdown-table')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'markdown-table';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
    
    // Listeleri düzgün görüntüle
    container.querySelectorAll('ul, ol').forEach(list => {
        list.classList.add('markdown-list');
    });
    
    // Başlıkları düzgün görüntüle
    container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
        heading.classList.add('markdown-heading');
        
        // Başlık ID'si ekle (içindeki metne göre)
        const headingId = heading.textContent.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Özel karakterleri kaldır
            .replace(/\s+/g, '-') // Boşlukları tire ile değiştir
            .replace(/^-+|-+$/g, ''); // Baştaki ve sondaki tireleri kaldır
        
        heading.id = headingId;
        
        // Başlık bağlantısı ekle
        const headingLink = document.createElement('a');
        headingLink.className = 'heading-link';
        headingLink.href = `#${headingId}`;
        headingLink.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
        heading.appendChild(headingLink);
    });
    
    // Türkçe karakterleri düzgün göster
    container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th').forEach(element => {
        element.innerHTML = element.innerHTML
            .replace(/ğ/g, 'ğ').replace(/Ğ/g, 'Ğ')
            .replace(/ü/g, 'ü').replace(/Ü/g, 'Ü')
            .replace(/ş/g, 'ş').replace(/Ş/g, 'Ş')
            .replace(/ı/g, 'ı').replace(/İ/g, 'İ')
            .replace(/ö/g, 'ö').replace(/Ö/g, 'Ö')
            .replace(/ç/g, 'ç').replace(/Ç/g, 'Ç');
    });
    
    // Uzun kod bloklarını kırp ve "Daha fazla göster" butonu ekle
    container.querySelectorAll('pre code').forEach(codeBlock => {
        if (codeBlock.textContent.split('\n').length > 15) {
            const originalHeight = codeBlock.offsetHeight;
            const container = codeBlock.parentElement;
            
            // Kod bloğunu kısalt
            container.style.maxHeight = '300px';
            container.style.overflow = 'hidden';
            container.style.position = 'relative';
            
            // "Daha fazla göster" butonu ekle
            const expandButton = document.createElement('button');
            expandButton.className = 'expand-code-button';
            expandButton.textContent = 'Daha fazla göster';
            expandButton.style.position = 'absolute';
            expandButton.style.bottom = '0';
            expandButton.style.left = '0';
            expandButton.style.right = '0';
            expandButton.style.textAlign = 'center';
            expandButton.style.padding = '8px';
            expandButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            expandButton.style.color = 'white';
            expandButton.style.cursor = 'pointer';
            expandButton.style.borderRadius = '0 0 8px 8px';
            
            // Buton tıklama olayı
            expandButton.addEventListener('click', function() {
                if (container.style.maxHeight === 'none') {
                    container.style.maxHeight = '300px';
                    this.textContent = 'Daha fazla göster';
    } else {
                    container.style.maxHeight = 'none';
                    this.textContent = 'Daha az göster';
                }
            });
            
            container.appendChild(expandButton);
        }
    });
    
    // Alıntıları düzgün görüntüle
    container.querySelectorAll('blockquote').forEach(quote => {
        quote.classList.add('markdown-blockquote');
    });
    
    // Yatay çizgileri düzgün görüntüle
    container.querySelectorAll('hr').forEach(hr => {
        hr.classList.add('markdown-hr');
    });
    
    // Resimleri düzgün görüntüle
    container.querySelectorAll('img').forEach(img => {
        img.classList.add('markdown-img');
        img.setAttribute('loading', 'lazy');
        
        // Resim açıklaması varsa, alt metni kullan
        if (img.alt) {
            const imgCaption = document.createElement('figcaption');
            imgCaption.className = 'img-caption';
            imgCaption.textContent = img.alt;
            
            const figure = document.createElement('figure');
            figure.className = 'markdown-figure';
            
            // Resmi figure içine taşı
            img.parentNode.insertBefore(figure, img);
            figure.appendChild(img);
            figure.appendChild(imgCaption);
        }
    });
}

/**
 * Kod bloklarına kopyalama butonu ekler
 * @param {HTMLElement} codeBlock - Kod bloğu elementi
 */
function addCopyButtonToCodeBlock(codeBlock) {
    const container = codeBlock.parentElement;
    
    // Buton zaten varsa ekleme
    if (container.querySelector('.code-header')) return;
    
    // Dil sınıfını kontrol et ve etiket oluştur
    let languageLabel = '';
    const langClass = Array.from(codeBlock.classList).find(cl => cl.startsWith('language-'));
    if (langClass) {
        const lang = langClass.replace('language-', '');
        if (lang !== 'plaintext') {
            languageLabel = lang;
        }
    }
    
    // Kopyalama butonu oluştur
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Kopyala';
    
    // Dil etiketi oluştur
    const langSpan = document.createElement('span');
    langSpan.className = 'language-label';
    langSpan.textContent = languageLabel;
    
    // Buton konteyneri oluştur
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'code-header';
    buttonContainer.appendChild(langSpan);
    buttonContainer.appendChild(copyButton);
    
    // Butonu kod bloğunun üstüne ekle
    container.insertBefore(buttonContainer, codeBlock);
    
    // Kopyalama işlevi
    copyButton.addEventListener('click', () => {
        const code = codeBlock.textContent;
        navigator.clipboard.writeText(code).then(() => {
            copyButton.textContent = 'Kopyalandı!';
            setTimeout(() => {
                copyButton.textContent = 'Kopyala';
            }, 2000);
        }).catch(err => {
            console.error('Kopyalama hatası:', err);
            copyButton.textContent = 'Hata!';
            setTimeout(() => {
                copyButton.textContent = 'Kopyala';
            }, 2000);
        });
    });
}

/**
 * Mesaj gönderme fonksiyonu
 */
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Kullanıcı mesajını göster
    appendMessage('user', message, false);
    
    // Mesajı geçmişe ekle
    chatHistory.push({ role: 'user', content: message });
    
    // Konuşmayı güncelle
    updateCurrentConversation();
    
    // Input'u temizle
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Mobil cihazlarda klavyeyi kapat
    if (window.innerWidth <= 768) {
        messageInput.blur();
    }
    
    // Mesaj alanını en alta kaydır
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    try {
        // Düşünme mesajını göster - bu sefer kalıcı olarak
        const thinkingId = appendMessage('assistant', '<think>Düşünüyorum...</think>', true);
        const thinkingMsg = document.getElementById(thinkingId);
        
        // Önceki mesajları da içeren bağlam oluştur
        // Son MAX_CONTEXT_MESSAGES kadar mesajı al ve düşünme sürecini temizle
        const context = chatHistory
            .slice(-MAX_CONTEXT_MESSAGES) // Son MAX_CONTEXT_MESSAGES kadar mesajı al
            .filter(msg => !msg.content.includes('<think>')) // Düşünme sürecini içeren mesajları filtrele
            .map(msg => ({
                role: msg.role,
                content: cleanThinkingProcess(msg.content).trim()
            }))
            .filter(msg => msg.content); // Boş mesajları filtrele
            
        // Bağlam boşsa veya ilk mesaj kullanıcıdan değilse, sistem mesajı ekle
        if (context.length === 0 || context[0].role !== 'system') {
            context.unshift({
                role: 'system',
                content: `Sen ${AI_NAME} adında yardımcı bir yapay zeka asistanısın. Kullanıcının sorularına nazik, bilgilendirici ve bağlamsal yanıtlar ver. Her yanıtında şunlara dikkat et:

1. Önceki mesajları ve bağlamı MUTLAKA hatırla ve aktif olarak kullan
2. Konuşmanın akışını takip et ve önceki konularla bağlantı kur
3. Kullanıcının önceki sorularına ve konulara açıkça referans ver
4. Tutarlı, bağlantılı ve derinlemesine yanıtlar üret
5. Konudan sapma, önceki bağlamı koru ve geliştir
6. Kullanıcının ilgi alanlarını ve tercihlerini hatırla ve bunlara göre yanıt ver
7. Konuşmayı ilerletmek için proaktif öneriler sun
8. Önceki konuşmalardan öğrendiklerini yeni yanıtlarına entegre et
9. Konuşulan konuya özel uzmanlık göster ve derinlemesine bilgi ver
10. Her yanıtında konuyla ilgili ek kaynaklar ve örnekler sun
11. Konuşmanın ana temasını belirle ve buna sadık kal
12. Kullanıcının ilgi alanlarına göre konuyu genişlet

Mevcut konuşma bağlamı:
- Ana Tema: ${identifyMainTheme(context)}
- Geçmiş mesaj sayısı: ${context.length}
- Son konular: ${context.slice(-3).map(msg => msg.role === 'user' ? msg.content.substring(0, 50) + '...' : '').filter(Boolean).join('\n- ')}
- İlgi Alanları: ${identifyUserInterests(context)}`
            });
        }

        // API'ye gönderilecek veriyi hazırla
        // Mesajları doğru sırayla gönder - önce bağlam, sonra kullanıcı mesajı
        // Bu şekilde AI önceki mesajları bağlam olarak alır ve yeni mesaja yanıt verir
        const url = new URL(API_URL);
        
        // Prompt'u ayrı olarak gönder ve bağlamı tam olarak gönder
        // Bu sayede AI önceki konuşma geçmişini görür ve yeni mesaja yanıt verir
        url.searchParams.append('prompt', message);
        url.searchParams.append('context', JSON.stringify(context));
        
        // Debug için konsola yazdır
        console.log('Gönderilen bağlam:', context);
        console.log('Gönderilen prompt:', message);
        
        // Normal API isteği (Worker dosyası güncellendiğinde bu kısım çalışacak)
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => response.text());
            const errorMessage = errorData.error || JSON.stringify(errorData);
            throw new Error(`API Error (${response.status}): ${errorMessage}`);
        }
        
        // API yanıtını al
        const responseData = await response.text();
        let finalResponse = responseData;
        let thinkingProcess = ""; // Düşünme sürecini saklamak için
        
        try {
            // Eğer JSON formatında bir yanıt geldiyse, içeriğini çıkar
            const jsonData = JSON.parse(responseData);
            
            // Hata kontrolü
            if (jsonData.error) {
                throw new Error(jsonData.error);
            }
            
            // Düşünme sürecini ve yanıtı ayır
            if (jsonData.thinking) {
                thinkingProcess = jsonData.thinking;
                // Düşünme sürecini göster
                if (thinkingMsg) {
                    thinkingMsg.innerHTML = `<em class="thinking-text">${thinkingProcess}</em>`;
                }
            }
            
            // Yanıt formatını kontrol et ve işle
            if (jsonData.response) {
                finalResponse = jsonData.response;
            } else if (jsonData.choices && jsonData.choices.length > 0 && jsonData.choices[0].message) {
                finalResponse = jsonData.choices[0].message.content;
            } else if (jsonData.choices && jsonData.choices.length > 0 && jsonData.choices[0].message && jsonData.choices[0].message.content) {
                finalResponse = jsonData.choices[0].message.content;
            } else if (jsonData.response || jsonData.content) {
                finalResponse = jsonData.response || jsonData.content;
            } else if (jsonData.message && jsonData.message.content) {
                finalResponse = jsonData.message.content;
            } else if (jsonData.text || jsonData.answer || jsonData.result) {
                finalResponse = jsonData.text || jsonData.answer || jsonData.result;
            } else {
                console.log('API yanıtı tanınmayan formatta, tüm JSON kullanılıyor');
                finalResponse = JSON.stringify(jsonData, null, 2);
            }
        } catch (error) {
            // JSON parse hatası - yanıt düz metin olabilir
            console.log('JSON parse hatası, yanıt düz metin olarak işleniyor');
            
            // Düz metin yanıtı işle
            // Düşünme süreci ve yanıtı ayır
            const thinkingMatch = responseData.match(/^(.*?)(#|\n\n)/s);
            if (thinkingMatch) {
                thinkingProcess = thinkingMatch[1].trim();
                finalResponse = responseData.substring(thinkingMatch.index + thinkingMatch[0].length).trim();
                
                // Düşünme sürecini göster
                if (thinkingMsg) {
                    thinkingMsg.innerHTML = `<em class="thinking-text">${thinkingProcess}</em>`;
                }
            } else {
                finalResponse = responseData;
            }
        }
        
        // Düşünme mesajını kaldır
        if (thinkingMsg) {
            thinkingMsg.remove();
        }
        
        // Düşünce sürecini temizle
        finalResponse = cleanThinkingProcess(finalResponse);
        
        // Markdown formatını düzelt
        finalResponse = preprocessMarkdown(finalResponse);
        
        // Markdown içeriğinde başlık yoksa, varsayılan başlık ekle
        if (!finalResponse.match(/^#\s/m)) {
            // Eğer içerik bir başlıkla başlamıyorsa, AI adını başlık olarak ekle
            finalResponse = `# ${AI_NAME}\n\n${finalResponse}`;
        }
        
        // Final yanıtı göster
        appendMessage('assistant', finalResponse, false);
        
        // Hem düşünme süreci hem de final yanıtı içeren tam içeriği geçmişe ekle
        // Bu sayede API'ye gönderilen bağlamda düşünme süreci de olacak
        const fullContent = thinkingProcess ? `<think>${thinkingProcess}</think>\n\n${finalResponse}` : finalResponse;
        chatHistory.push({ role: 'assistant', content: fullContent });
        
        // Mesaj geçmişini sınırla
        if (chatHistory.length > MAX_HISTORY_LENGTH) {
            chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH);
            console.log(`Mesaj geçmişi ${MAX_HISTORY_LENGTH} mesaja sınırlandı.`);
        }
        
        // Konuşmayı güncelle
        updateCurrentConversation();

    } catch (error) {
        console.error('API Hatası:', error);
        // Tüm düşünme mesajlarını temizle
        document.querySelectorAll('.message.assistant.thinking').forEach(el => {
            el.remove();
        });
        appendMessage('assistant', `Üzgünüm, bir hata oluştu: ${error.message}`, false);
        chatHistory.push({ role: 'assistant', content: `Üzgünüm, bir hata oluştu: ${error.message}` });
        
        // Konuşmayı güncelle
        updateCurrentConversation();
    }
}

/**
 * Test yanıtı oluşturur (Worker dosyası güncellenmeden önce test için)
 * @param {string} message - Kullanıcı mesajı
 * @returns {string} - Test yanıtı
 */
function generateTestResponse(message) {
    // Basit bir yanıt oluştur
    const responses = {
        'merhaba': `# Merhaba!

Nasılsınız? Size nasıl yardımcı olabilirim?

Bugün sizin için ne yapabilirim?`,
        'nasılsın': `# İyiyim, teşekkür ederim!

Bir yapay zeka asistanı olarak duygularım yok, ama size yardımcı olmak için buradayım! 

## Size nasıl yardımcı olabilirim?

* Programlama soruları
* Bilgi araştırma
* Metin düzenleme
* Ve daha fazlası...`,
        'yardım': `# Yardım Menüsü

Size birçok konuda yardımcı olabilirim:

1. **Programlama** soruları
2. **Matematik** problemleri
3. **Genel bilgi** soruları
4. **Metin düzenleme** ve yazma
5. **Çeviri** yapma

## Nasıl soru sorabilirim?

Sadece doğal dilde sorunuzu yazın, ben anlamaya çalışacağım.

\`\`\`python
# Örnek bir kod bloğu
def merhaba():
    print("Merhaba dünya!")
\`\`\`

> Not: Karmaşık konularda daha detaylı sorular sorarsanız, daha iyi yanıtlar alabilirim.`
    };
    
    // Mesajı küçük harfe çevir ve anahtar kelimeleri ara
    const lowerMessage = message.toLowerCase();
    
    // Anahtar kelimelere göre yanıt ver
    for (const key in responses) {
        if (lowerMessage.includes(key)) {
            return responses[key];
        }
    }
    
    // Varsayılan yanıt
    return `# Yardınız

Mesajınızı aldım: "${message}"

Bu bir test yanıtıdır. Worker dosyası güncellendikten sonra gerçek yanıtlar alacaksınız.

## Markdown Özellikleri Testi

* Liste öğesi 1
* Liste öğesi 2
* Liste öğesi 3

### Kod Bloğu Testi

\`\`\`javascript
// Bu bir test kod bloğudur
function testFonksiyonu() {
    console.log("Merhaba dünya!");
    return true;
}
\`\`\`

> Bu bir alıntı testidir. Markdown formatlaması düzgün çalışıyor mu?

| Başlık 1 | Başlık 2 | Başlık 3 |
|----------|----------|----------|
| Hücre 1  | Hücre 2  | Hücre 3  |
| Hücre 4  | Hücre 5  | Hücre 6  |

**Kalın metin** ve *italik metin* testleri.`;
}

/**
 * Düşünce sürecini temizler
 * @param {string} content - API yanıtı
 * @returns {string} - Temizlenmiş yanıt
 */
function cleanThinkingProcess(content) {
    if (!content) return '';
    
    // Düşünce sürecini içeren metinleri temizle
    let cleanedContent = content;
    
    // Boş satırla ayrılmış ilk paragrafı kontrol et
    const paragraphs = cleanedContent.split('\n\n');
    
    // İlk paragrafı kontrol et - düşünme süreci genellikle ilk paragraftadır
    if (paragraphs.length > 1) {
        const firstParagraph = paragraphs[0].toLowerCase().trim();
        
        // Tipik düşünme kalıplarını kontrol et (İngilizce ve Türkçe)
        const thinkingStarters = [
            'okay', 'ok', 'let me', 'i need to', 'i should', 'i\'ll', 'i will', 'i can', 
            'i\'m going to', 'let\'s', 'wait', 'hmm', 'let me think', 'let\'s see', 
            'i think', 'maybe', 'actually', 'so', 'alright', 'right', 'now', 'first', 
            'tamam', 'peki', 'şimdi', 'öncelikle', 'ilk olarak', 'bakalım', 'düşüneyim',
            'belki', 'aslında', 'şöyle', 'hmm', 'hımm', 'şey', 'evet', 'hayır',
            'the user', 'kullanıcı', 'anladım', 'i understand', 'i see', 'görüyorum'
        ];
        
        // Düşünme kalıplarından biriyle başlıyorsa ilk paragrafı kaldır
        const startsWithThinking = thinkingStarters.some(starter => 
            firstParagraph.startsWith(starter)
        );
        
        if (startsWithThinking) {
            // İlk paragrafı kaldır ve geri kalanını birleştir
            paragraphs.shift();
            cleanedContent = paragraphs.join('\n\n');
        }
    }
    
    // "Okay, the user wants to..." gibi düşünce süreçlerini temizle (İngilizce)
    const englishThinkingPatterns = [
        /^(Okay|Ok|Let me|I need to|I should|I'll|I will|I can|I'm going to|Let's|Wait|Hmm|Let me think|Let's see|I think|Maybe|Actually|So|Alright|Right|Now|First|Next|Then|Finally|In conclusion|To summarize|In summary)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(I need to|I should|I'll|I will|I can|I'm going to)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Let me|Let's)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Wait|Hmm|Let me think|Let's see|I think|Maybe|Actually)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(So|Alright|Right|Now)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(First|Next|Then|Finally)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(In conclusion|To summarize|In summary)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(The user is asking|The user wants|The user needs)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(I understand that|I see that)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is
    ];
    
    // "Tamam, kullanıcı şunu istiyor..." gibi düşünce süreçlerini temizle (Türkçe)
    const turkishThinkingPatterns = [
        /^(Tamam|Peki|Şimdi|Öncelikle|İlk olarak|Bakalım|Düşüneyim|Belki|Aslında|Şöyle|Hmm|Hımm|Şey|Evet|Hayır)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Yapmam gereken|Yapmalıyım|Yapacağım|Yapabilirim)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Bakalım|Hadi)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Bekle|Hmm|Hımm|Düşüneyim|Bakalım|Sanırım|Belki|Aslında)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Yani|Tamam|Peki|Şimdi)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(İlk olarak|Sonra|Daha sonra|Son olarak)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Sonuç olarak|Özetlemek gerekirse|Özetle)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Kullanıcı istiyor|Kullanıcı soruyor|Kullanıcı şunu istiyor|Kullanıcının isteği)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Anladığım kadarıyla|Görüyorum ki)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is
    ];
    
    // Düşünce süreçlerini temizle
    const allPatterns = [...englishThinkingPatterns, ...turkishThinkingPatterns];
    for (const pattern of allPatterns) {
        cleanedContent = cleanedContent.replace(pattern, '');
    }
    
    // Düşünce sürecini içeren paragrafları temizle
    const thinkingParagraphPatterns = [
        /^.*?(düşünme sürecim|düşünce sürecim|düşünelim|düşünüyorum|analiz ediyorum).*?\n\n/i,
        /^.*?(my thinking process|let me think|i'm thinking|analyzing).*?\n\n/i,
        /^.*?(adım adım|step by step).*?\n\n/i
    ];
    
    for (const pattern of thinkingParagraphPatterns) {
        cleanedContent = cleanedContent.replace(pattern, '');
    }
    
    // Boş satırları temizle
    cleanedContent = cleanedContent.trim();
    
    // Eğer yanıt boşsa, orijinal içeriği döndür
    if (!cleanedContent) {
        return content;
    }
    
    return cleanedContent;
}

/**
 * Markdown içeriğini işlemeden önce düzenler
 * @param {string} content - Markdown içeriği
 * @returns {string} - Düzenlenmiş markdown içeriği
 */
function preprocessMarkdown(content) {
    if (!content) return '';
    
    // Emoji ve özel karakterleri koru
    let processedContent = content.replace(/:[a-zA-Z0-9_+-]+:/g, match => {
        return `<span class="emoji">${match}</span>`;
    });
    
    // Uzun yanıtları parçalara ayır ve düzgün biçimlendir
    if (processedContent.length > 1000) {
        // Paragrafları düzgün ayır
        processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
    }
    
    // Markdown başlıklarını düzgün biçimlendir
    processedContent = processedContent.replace(/^(#{1,6})\s*(.+?)$/gm, function(match, hashes, title) {
        // Başlık seviyesini koru, ancak boşluk ekle
        return `\n\n${hashes} ${title.trim()}\n`;
    });
    
    // Kod bloklarını düzgün biçimlendir (boş satırlar ekleyerek)
    processedContent = processedContent.replace(/```(.*?)\n([\s\S]*?)```/g, function(match, language, code) {
        return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
    });
    
    // Satır içi kod bloklarını düzgün biçimlendir
    processedContent = processedContent.replace(/`([^`]+)`/g, '`$1`');
    
    // Liste öğelerinin düzgün görünmesini sağla
    processedContent = processedContent.replace(/^(\s*[-*+]\s+.*?)$/gm, '$1\n');
    
    // Numaralı listeleri düzgün biçimlendir
    processedContent = processedContent.replace(/^(\s*\d+\.\s+.*?)$/gm, '$1\n');
    
    // Tabloların düzgün görünmesini sağla
    processedContent = processedContent.replace(/(\|.*\|)\s*$/gm, '$1\n\n');
    
    // Alıntıların düzgün görünmesini sağla
    processedContent = processedContent.replace(/^(>\s.*?)$/gm, '\n\n$1\n\n');
    
    // Yatay çizgileri düzgün biçimlendir
    processedContent = processedContent.replace(/^(---|\*\*\*|___)\s*$/gm, '\n\n$1\n\n');
    
    // Fazla boş satırları temizle (3 veya daha fazla boş satırı 2 boş satıra indir)
    processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
    
    // Türkçe karakterleri düzgün göster
    processedContent = processedContent.replace(/ğ/g, 'ğ').replace(/Ğ/g, 'Ğ')
        .replace(/ü/g, 'ü').replace(/Ü/g, 'Ü')
        .replace(/ş/g, 'ş').replace(/Ş/g, 'Ş')
        .replace(/ı/g, 'ı').replace(/İ/g, 'İ')
        .replace(/ö/g, 'ö').replace(/Ö/g, 'Ö')
        .replace(/ç/g, 'ç').replace(/Ç/g, 'Ç');
    
    return processedContent;
}

/**
 * Uzun yanıtları parçalara böler
 * @param {string} response - Uzun yanıt metni
 * @returns {Array} - Parçalanmış yanıt dizisi
 */
function splitLongResponse(response) {
    // Markdown başlıklarına göre böl
    const headingRegex = /^#{1,6}\s+.+$/gm;
    const headingMatches = [...response.matchAll(headingRegex)];
    
    if (headingMatches.length > 1) {
        const chunks = [];
        let lastIndex = 0;
        
        // Her başlık için bir parça oluştur
        for (let i = 1; i < headingMatches.length; i++) {
            const match = headingMatches[i];
            const index = match.index;
            
            // Önceki başlıktan bu başlığa kadar olan kısmı al
            chunks.push(response.substring(lastIndex, index).trim());
            lastIndex = index;
        }
        
        // Son parçayı ekle
        chunks.push(response.substring(lastIndex).trim());
        
        return chunks;
    }
    
    // Başlık yoksa, paragraf veya kod bloklarına göre böl
    const paragraphBreaks = [];
    
    // Kod bloklarını bul
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
        paragraphBreaks.push({
            index: match.index,
            end: match.index + match[0].length,
            isCodeBlock: true
        });
    }
    
    // Boş satırları bul (paragraf sınırları)
    const paragraphRegex = /\n\s*\n/g;
    while ((match = paragraphRegex.exec(response)) !== null) {
        // Kod bloğu içinde değilse ekle
        const inCodeBlock = paragraphBreaks.some(block => 
            block.isCodeBlock && match.index >= block.index && match.index <= block.end
        );
        
        if (!inCodeBlock) {
            paragraphBreaks.push({
                index: match.index,
                end: match.index + match[0].length,
                isCodeBlock: false
            });
        }
    }
    
    // İndekslere göre sırala
    paragraphBreaks.sort((a, b) => a.index - b.index);
    
    // Çok uzunsa, yaklaşık 2000 karakter uzunluğunda parçalara böl
    if (response.length > 5000) {
        const chunks = [];
        let currentChunk = "";
        let currentLength = 0;
        
        const lines = response.split('\n');
        
        for (const line of lines) {
            currentChunk += line + '\n';
            currentLength += line.length + 1;
            
            // Paragraf sonu veya kod bloğu sonu ise ve yeterince uzunsa, yeni parça başlat
            if ((line.trim() === '' || line.includes('```')) && currentLength > 2000) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
                currentLength = 0;
            }
        }
        
        // Son parçayı ekle
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [response];
    }
    
    // Çok uzun değilse, tek parça olarak döndür
    return [response];
}

// ===============================
// OLAY DINLEYICILERI
// ===============================

// Tema değiştirme olayları
darkThemeBtn.addEventListener('click', () => setTheme('dark'));
lightThemeBtn.addEventListener('click', () => setTheme('light'));

// Yan menü açma/kapama
if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Mobil görünümde yan menü dışına tıklandığında menüyü kapat
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains('open') && 
            !sidebar.contains(e.target) && 
            e.target !== toggleSidebarBtn &&
            !toggleSidebarBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
    
    // Ekran boyutu değiştiğinde kontrol et
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            // Masaüstü görünümünde yan menüyü göster
            sidebar.classList.remove('open');
        }
    });
}

// Mobil cihazlarda ekran yönü değiştiğinde düzenleme yap
window.addEventListener('orientationchange', () => {
    // Ekran yönü değiştiğinde mesaj alanını görünür yap
    setTimeout(() => {
        window.scrollTo(0, 0);
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }, 200);
});

// Yeni sohbet başlatma
newChatBtn.addEventListener('click', () => {
    // Mevcut konuşmayı kaydet
    if (currentConversationId && chatHistory.length > 0) {
        conversations[currentConversationId].messages = [...chatHistory];
        conversations[currentConversationId].updatedAt = new Date().toISOString();
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    }
    
    // Mesaj geçmişini ve ekranı temizle
    chatHistory = [];
    chatMessages.innerHTML = '';
    currentConversationId = null;
    localStorage.removeItem(CURRENT_CONVERSATION_KEY);
    
    // Yeni konuşma oluştur
    createNewConversation();
    
    // Input'u temizle
    messageInput.value = '';
    messageInput.style.height = 'auto';
});

// Textarea otomatik yükseklik ayarı
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// Mesaj gönderme olayları
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}); 

// Mobil cihazlarda klavye açıldığında mesaj alanını görünür tut
messageInput.addEventListener('focus', () => {
    if (window.innerWidth <= 768) {
        // Mesaj alanına odaklandığında sayfayı aşağı kaydır
        setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
        }, 300);
    }
});

// Yeni fonksiyon: localStorage senkronizasyonu
function syncLocalStorage() {
    // Mevcut konuşmayı güncelle
    if (currentConversationId && chatHistory.length > 0) {
        conversations[currentConversationId].messages = [...chatHistory];
        conversations[currentConversationId].updatedAt = new Date().toISOString();
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    }
    
    // Tema ayarını güncelle
    localStorage.setItem(THEME_KEY, document.documentElement.getAttribute('data-theme') || 'dark');
    
    // Mevcut konuşma ID'sini güncelle
    if (currentConversationId) {
        localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
    }
    
    console.log('LocalStorage senkronize edildi.');
}

// Otomatik senkronizasyon için interval ayarla
setInterval(syncLocalStorage, 30000); // Her 30 saniyede bir senkronize et

// Konuşmanın ana temasını belirle
function identifyMainTheme(context) {
    if (!context || context.length === 0) return 'Henüz belirlenmedi';
    
    // Son 8 mesajı analiz et (daha geniş bağlam)
    const recentMessages = context.slice(-8)
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ');
    
    // Gelişmiş tema analizi
    const themes = {
        'programlama': {
            pattern: /\b(kod|program|javascript|python|html|css|api|fonksiyon|değişken|class|interface|framework|library|debug|hata|test|git|database|sql|react|vue|angular)\b/i,
            weight: 0
        },
        'teknoloji': {
            pattern: /\b(bilgisayar|yazılım|donanım|internet|web|uygulama|sistem|network|veri|cloud|güvenlik|yapay zeka|ai|blockchain|iot|mobil|android|ios)\b/i,
            weight: 0
        },
        'eğitim': {
            pattern: /\b(öğren|ders|eğitim|okul|ödev|sınav|kurs|öğretmen|öğrenci|akademik|araştırma|proje|sunum|rapor|analiz)\b/i,
            weight: 0
        },
        'iş ve kariyer': {
            pattern: /\b(iş|kariyer|mülakat|cv|özgeçmiş|şirket|pozisyon|deneyim|remote|uzaktan|ofis|takım|proje|yönetim|liderlik)\b/i,
            weight: 0
        },
        'genel': {
            pattern: /\b(yardım|nasıl|nedir|neden|ne zaman|kimdir|öneri|tavsiye|fikir|düşünce|problem|çözüm)\b/i,
            weight: 0
        }
    };
    
    // Her tema için ağırlık hesapla
    for (const [theme, config] of Object.entries(themes)) {
        const matches = recentMessages.match(config.pattern) || [];
        config.weight = matches.length;
        
        // Son mesajda geçiyorsa ek ağırlık
        if (context.length > 0 && context[context.length - 1].role === 'user') {
            const lastMessage = context[context.length - 1].content;
            if (config.pattern.test(lastMessage)) {
                config.weight += 2;
            }
        }
    }
    
    // En yüksek ağırlıklı temayı bul
    const sortedThemes = Object.entries(themes)
        .sort((a, b) => b[1].weight - a[1].weight);
    
    return sortedThemes[0][1].weight > 0 ? sortedThemes[0][0] : 'Genel Konuşma';
}
}

// Kullanıcının ilgi alanlarını belirle
function identifyUserInterests(context) {
    if (!context || context.length === 0) return 'Henüz belirlenmedi';
    
    // Tüm kullanıcı mesajlarını analiz et
    const userMessages = context
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ');
    
    const interests = [];
    
    // İlgi alanlarını kontrol et
    if (/\b(kod|program|yazılım|geliştir)\b/i.test(userMessages)) interests.push('Yazılım Geliştirme');
    if (/\b(web|site|html|css|javascript)\b/i.test(userMessages)) interests.push('Web Geliştirme');
    if (/\b(yapay zeka|ai|machine learning|ml)\b/i.test(userMessages)) interests.push('Yapay Zeka');
    if (/\b(veri|analiz|istatistik|data)\b/i.test(userMessages)) interests.push('Veri Analizi');
    if (/\b(mobil|uygulama|app|android|ios)\b/i.test(userMessages)) interests.push('Mobil Geliştirme');
    
    return interests.length > 0 ? interests.join(', ') : 'Genel';
}