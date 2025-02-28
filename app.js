// ===============================
// SABITLER VE KONFIGÜRASYON
// ===============================

// LocalStorage anahtarları
const STORAGE_KEY = 'ai_hub_chat_history';
const THEME_KEY = 'ai_hub_theme';
const CONVERSATIONS_KEY = 'ai_hub_conversations';
const CURRENT_CONVERSATION_KEY = 'ai_hub_current_conversation';

// API URL
const API_URL = 'https://ai-hub.istebutolga.workers.dev/';

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
    renderer: new marked.Renderer(),
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-',
    headerIds: false,
    mangle: false,
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false,
    smartLists: true,
    smartypants: true,
    xhtml: false
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
    
    if (content.includes('<think>')) {
        // Düşünme içeriğini işle
        messageDiv.innerHTML = content.replace(/<think>(.*?)<\/think>/g, '<em class="thinking-text">$1</em>');
    } else if (role === 'assistant' && !isThinking) {
        // Markdown'ı HTML'e çevir
        try {
            // Markdown içeriğini düzenle - kod bloklarını ve diğer markdown öğelerini düzgün biçimlendir
            let processedContent = preprocessMarkdown(content);
            
            // Markdown'ı HTML'e çevir
            const rawHtml = marked.parse(processedContent);
            
            // XSS koruması için DOMPurify kullan (eğer varsa)
            const cleanHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
            messageDiv.innerHTML = cleanHtml;
            
            // Kod bloklarını renklendir
            messageDiv.querySelectorAll('pre code').forEach((block) => {
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
            messageDiv.querySelectorAll('a').forEach(link => {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });
            
            // Tabloları düzgün görüntüle
            messageDiv.querySelectorAll('table').forEach(table => {
                // Eğer tablo zaten bir wrapper içinde değilse
                if (!table.parentNode.classList.contains('markdown-table')) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'markdown-table';
                    table.parentNode.insertBefore(wrapper, table);
                    wrapper.appendChild(table);
                }
            });
            
            // Listeleri düzgün görüntüle
            messageDiv.querySelectorAll('ul, ol').forEach(list => {
                list.classList.add('markdown-list');
            });
            
            // Başlıkları düzgün görüntüle
            messageDiv.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                heading.classList.add('markdown-heading');
            });
            
            // Türkçe karakterleri düzgün göster
            messageDiv.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th').forEach(element => {
                element.innerHTML = element.innerHTML
                    .replace(/ğ/g, 'ğ').replace(/Ğ/g, 'Ğ')
                    .replace(/ü/g, 'ü').replace(/Ü/g, 'Ü')
                    .replace(/ş/g, 'ş').replace(/Ş/g, 'Ş')
                    .replace(/ı/g, 'ı').replace(/İ/g, 'İ')
                    .replace(/ö/g, 'ö').replace(/Ö/g, 'Ö')
                    .replace(/ç/g, 'ç').replace(/Ç/g, 'Ç');
            });
            
            // Uzun kod bloklarını kırp ve "Daha fazla göster" butonu ekle
            messageDiv.querySelectorAll('pre code').forEach(codeBlock => {
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
            
        } catch (error) {
            console.error('Markdown işleme hatası:', error);
            messageDiv.textContent = content;
        }
    } else {
        messageDiv.textContent = content;
    }
    
    const messageId = 'msg-' + Date.now();
    messageDiv.id = messageId;
    chatMessages.appendChild(messageDiv);
    
    // Otomatik scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageId;
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

    try {
        // Düşünme mesajını göster - bu sefer kalıcı olarak
        const thinkingId = appendMessage('assistant', '<think>Düşünüyorum...</think>', true);
        const thinkingMsg = document.getElementById(thinkingId);
        
        // Önceki mesajları da içeren bağlam oluştur
        const context = chatHistory.slice(-10); // Son 10 mesajı al
        
        // TEST MODU - Worker dosyası güncellenmeden önce test etmek için
        // Bu kısım worker dosyası güncellendiğinde kaldırılabilir
        const TEST_MODE = false;
        
        if (TEST_MODE) {
            // Düşünme sürecini simüle et
            let thinkingSteps = [
                "Kullanıcının mesajını analiz ediyorum...",
                "Bu soruya nasıl yanıt verebileceğimi düşünüyorum...",
                "Bilgilerimi organize ediyorum...",
                "En iyi yanıtı oluşturuyorum...",
                "Yanıtımı Türkçe dilbilgisi açısından kontrol ediyorum..."
            ];
            
            // Düşünme adımlarını göster
            for (let i = 0; i < thinkingSteps.length; i++) {
                if (thinkingMsg) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    thinkingMsg.innerHTML = `<em class="thinking-text">${thinkingSteps[i]}</em>`;
                }
            }
            
            // Düşünme mesajını kaldır
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (thinkingMsg) {
                thinkingMsg.remove();
            }
            
            // Test yanıtı oluştur
            let finalResponse = generateTestResponse(message);
            
            // Final yanıtı göster
            appendMessage('assistant', finalResponse, false);
            chatHistory.push({ role: 'assistant', content: finalResponse });
            
            // Konuşmayı güncelle
            updateCurrentConversation();
            return;
        }
        
        // Normal API isteği (Worker dosyası güncellendiğinde bu kısım çalışacak)
        const response = await fetch(`${API_URL}?prompt=${encodeURIComponent(message)}&context=${encodeURIComponent(JSON.stringify(context))}`);
        if (!response.ok) {
            throw new Error(`API yanıt vermedi: ${response.status}`);
        }
        
        // Stream yanıtı için
        const reader = response.body.getReader();
        let receivedText = '';
        let finalResponse = '';
        let isThinking = true;
        
        // Yanıtı parça parça okuyup işle
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Yeni gelen veriyi işle
            const chunk = new TextDecoder().decode(value);
            receivedText += chunk;
            
            try {
                // JSON olarak parse etmeyi dene
                const data = JSON.parse(receivedText);
                console.log('API Yanıtı:', data);
                
                if (data.thinking && isThinking) {
                    // Düşünme sürecini güncelle
                    if (thinkingMsg) {
                        thinkingMsg.innerHTML = `<em class="thinking-text">${data.thinking}</em>`;
                    }
                } else if (data.response || data.content) {
                    // Final yanıtı al
                    finalResponse = data.response || data.content;
                    isThinking = false;
                    
                    // Düşünme mesajını kaldır ve final yanıtı göster
                    if (thinkingMsg) {
                        thinkingMsg.remove();
                    }
                    
                    // Düşünce sürecini temizle
                    finalResponse = cleanThinkingProcess(finalResponse);
                    
                    // Markdown formatını düzelt
                    finalResponse = preprocessMarkdown(finalResponse);
                    
                    // Final yanıtı göster
                    appendMessage('assistant', finalResponse, false);
                    chatHistory.push({ role: 'assistant', content: finalResponse });
                    
                    // Konuşmayı güncelle
                    updateCurrentConversation();
                    break;
                }
            } catch (e) {
                // JSON parse hatası - henüz tam veri gelmemiş olabilir
                // Düşünme sürecini güncellemeye devam et
                if (thinkingMsg && receivedText.includes('thinking')) {
                    try {
                        const thinkingMatch = receivedText.match(/"thinking":"([^"]*)"/);
                        if (thinkingMatch && thinkingMatch[1]) {
                            thinkingMsg.innerHTML = `<em class="thinking-text">${thinkingMatch[1]}</em>`;
                        }
                    } catch (innerError) {
                        console.error('Düşünme süreci işleme hatası:', innerError);
                    }
                }
            }
        }
        
        // Eğer hiç yanıt alınamadıysa
        if (!finalResponse && thinkingMsg) {
            // Düşünme mesajını kaldır
            thinkingMsg.remove();
            
            // Tüm yanıtı işle
            try {
                const data = JSON.parse(receivedText);
                finalResponse = data.response || data.content || '';
                
                // Düşünce sürecini temizle
                finalResponse = cleanThinkingProcess(finalResponse);
                
                // Markdown formatını düzelt
                finalResponse = preprocessMarkdown(finalResponse);
                
                // Final yanıtı göster
                if (finalResponse) {
                    appendMessage('assistant', finalResponse, false);
                    chatHistory.push({ role: 'assistant', content: finalResponse });
                }
            } catch (e) {
                console.error('Yanıt işleme hatası:', e);
                appendMessage('assistant', 'Üzgünüm, yanıtı işlerken bir hata oluştu.', false);
                chatHistory.push({ role: 'assistant', content: 'Üzgünüm, yanıtı işlerken bir hata oluştu.' });
            }
            
            // Konuşmayı güncelle
            updateCurrentConversation();
        }

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
    return `# Yanıtınız

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
    
    // "Okay, the user wants to..." gibi düşünce süreçlerini temizle
    const thinkingPatterns = [
        /^(Okay|Ok|Let me|I need to|I should|I'll|I will|I can|I'm going to|Let's|Wait|Hmm|Let me think|Let's see|I think|Maybe|Actually|So|Alright|Right|Now|First|Next|Then|Finally|In conclusion|To summarize|In summary)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Tamam|Peki|Şimdi|Öncelikle|İlk olarak|Bakalım|Düşüneyim|Belki|Aslında|Şöyle|Hmm|Hımm|Şey|Evet|Hayır)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(I need to|I should|I'll|I will|I can|I'm going to)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Yapmam gereken|Yapmalıyım|Yapacağım|Yapabilirim)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Let me|Let's)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Bakalım|Hadi)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Wait|Hmm|Let me think|Let's see|I think|Maybe|Actually)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Bekle|Hmm|Hımm|Düşüneyim|Bakalım|Sanırım|Belki|Aslında)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(So|Alright|Right|Now)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Yani|Tamam|Peki|Şimdi)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(First|Next|Then|Finally)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(İlk olarak|Sonra|Daha sonra|Son olarak)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(In conclusion|To summarize|In summary)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is,
        /^(Sonuç olarak|Özetlemek gerekirse|Özetle)[,\s].+?(?=\n\n|\n(?=[A-Z]))/is
    ];
    
    // Düşünce süreçlerini temizle
    for (const pattern of thinkingPatterns) {
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
    
    // Kod bloklarını düzgün biçimlendir (boş satırlar ekleyerek)
    processedContent = processedContent.replace(/```(.*?)\n([\s\S]*?)```/g, function(match, language, code) {
        return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
    });
    
    // Satır içi kod bloklarını düzgün biçimlendir
    processedContent = processedContent.replace(/`([^`]+)`/g, '`$1`');
    
    // Başlıkların önüne ve arkasına boşluk ekle
    processedContent = processedContent.replace(/^(#{1,6}\s.*?)$/gm, '\n\n$1\n\n');
    
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
            e.target !== toggleSidebarBtn) {
            sidebar.classList.remove('open');
        }
    });
}

// Yeni sohbet başlatma
newChatBtn.addEventListener('click', () => {
    // Mevcut konuşmayı güncelle
    if (currentConversationId && chatHistory.length > 0) {
        conversations[currentConversationId].messages = [...chatHistory];
        conversations[currentConversationId].updatedAt = new Date().toISOString();
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    }
    
    // Yeni konuşma başlat
    chatHistory = [];
    chatMessages.innerHTML = '';
    currentConversationId = null;
    localStorage.removeItem(CURRENT_CONVERSATION_KEY);
    
    // Konuşma listesini güncelle
    updateConversationsList();
});

// Textarea otomatik yükseklik ayarı
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Mesaj gönderme olayları
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// ===============================
// SAYFA YÜKLEME
// ===============================

// Sayfa yüklendiğinde sohbet geçmişini göster
window.addEventListener('load', () => {
    // Konuşma listesini oluştur
    updateConversationsList();
    
    // Mevcut konuşmayı yükle
    if (currentConversationId && conversations[currentConversationId]) {
        chatHistory = [...conversations[currentConversationId].messages];
        
        // Mesajları göster
        chatHistory.forEach(message => {
            appendMessage(message.role, message.content, false);
        });
    } else if (Object.keys(conversations).length > 0) {
        // En son konuşmayı yükle
        const sortedConversations = Object.values(conversations).sort((a, b) => {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        
        if (sortedConversations.length > 0) {
            currentConversationId = sortedConversations[0].id;
            localStorage.setItem(CURRENT_CONVERSATION_KEY, currentConversationId);
            chatHistory = [...sortedConversations[0].messages];
            
            // Mesajları göster
            chatHistory.forEach(message => {
                appendMessage(message.role, message.content, false);
            });
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

    // Yükleme animasyonunu kaldır
    setTimeout(() => {
        loaderContainer.style.opacity = '0';
        content.style.display = 'block';
        setTimeout(() => {
            loaderContainer.style.display = 'none';
        }, 500);
    }, 1000); // Yükleme süresini kısalttım
});

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