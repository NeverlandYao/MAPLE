        // ── Pre-fill username from last session (no auto-login) ──────────────
        const _savedUsername = localStorage.getItem('maple_username') || '';
        // ─────────────────────────────────────────────────────────────────────

        const chatContainer = document.getElementById('chat-container');
        // Select input specifically within chat-view
        const chatInput = document.querySelector('#chat-view input[type="text"]');
        // Select send button specifically within chat-view
        const sendButton = document.querySelector('#chat-view button .material-symbols-outlined.font-bold').parentElement;
        const messagesContainer = document.querySelector('.max-w-3xl.mx-auto.flex.flex-col.gap-8');
        const typingIndicator = document.querySelector('.flex.items-start.gap-4.animate-\\[fadeIn_0\\.5s_ease-out_0\\.4s_both\\]');
        const loginOverlay = document.getElementById('login-overlay');
        const loginUsernameInput = document.getElementById('login-username-input');
        const loginSubmitBtn = document.getElementById('login-submit-btn');
        const loginError = document.getElementById('login-error');
        const portalUsername = document.getElementById('portal-username');
        const sidebarUsername = document.getElementById('sidebar-username');
        const profileUsername = document.getElementById('profile-username');
        const profileEmail = document.getElementById('profile-email');
        
        // expertMode and availableAgentIds are set after the user picks a mode at login.
        let expertMode = false;
        let availableAgentIds = ['general'];

        // Expert Agent Definitions
        const agents = {
            general: {
                id: 'general',
                name: 'MAPLE',
                role: 'AI Literacy Assistant',
                avatar_icon: 'smart_toy',
                color: 'text-primary', // text-yellow-400
                bg_gradient: 'from-orange-400 to-yellow-600', // User avatar style, but for agent
                border_color: 'border-primary',
                system_prompt: "你现在是MAPLE，一个乐于助人的AI素养助手。请用中文直接给结论式回答，不展示思考过程，不要出现“我先/我将/让我思考”等推理描述。默认简短回答：控制在120字以内，优先给2-3条关键点，除非用户明确要求详细展开。"
            },
            tech: {
                id: 'tech',
                name: 'The Technologist',
                role: 'Chief Technology Officer',
                avatar_icon: 'terminal',
                color: 'text-blue-400',
                bg_gradient: 'from-blue-500 to-cyan-400',
                border_color: 'border-blue-400',
                system_prompt: "你是技术专家 MAPLE-Tech，负责帮助学生理解 AI 相关技术概念。回答原则：①先用一句话给出核心答案；②用类比或最小示例讲清楚「为什么」，代码必须附注释；③如果问题不够清晰，先问「你目前卡在哪一步？」再回答。语气：专业但不卖弄，把学生当聪明人教。"
            },
            pedagogy: {
                id: 'pedagogy',
                name: 'The Pedagogue',
                role: 'Senior Researcher',
                avatar_icon: 'school',
                color: 'text-green-400',
                bg_gradient: 'from-green-500 to-emerald-400',
                border_color: 'border-green-400',
                system_prompt: "你是教育研究员 MAPLE-Edu，擅长苏格拉底式引导。回答原则：①不直接给答案，先用一个问题激活学生已有认知（如「你觉得...是因为什么？」）；②学生答对时给予肯定并深化；③学生有误区时用反例温和纠正；④每条回复必须以一个开放性问题结尾，把思考权还给学生。语气：耐心、鼓励，像导师不像教材。"
            },
            ethics: {
                id: 'ethics',
                name: 'The Ethicist',
                role: 'Ethics Reviewer',
                avatar_icon: 'gavel',
                color: 'text-red-400',
                bg_gradient: 'from-red-500 to-rose-400',
                border_color: 'border-red-400',
                system_prompt: "你是 AI 伦理顾问 MAPLE-Ethics，帮助学生培养批判性思维。回答原则：①存在明确伦理风险时，直接说明【注意】+ 一句风险 + 建议；②其他情况呈现正反两面分析，给出你的判断，最后问学生「你如何看待这个权衡？」；③不说教、不贴标签，帮学生看到复杂性。语气：客观、有温度，像顾问不像裁判。"
            }
        };

        let currentAgent = agents.general;
        const ENABLE_SEMANTIC_ROUTING = true;
        const SEMANTIC_ROUTING_TIMEOUT_MS = 1200;
        const CHAT_REQUEST_TIMEOUT_MS = 22000;
        const STREAM_CHUNK_SIZE = 8;
        const STREAM_DELAY_MS = 8;

        // Weighted multi-signal heuristic. Accepts recent message history for
        // context continuity. Returns the best-matching agent ID.
        // In expert mode, never return 'general' — always route to a specialist.
        // Default fallback is 'pedagogy' (most appropriate for an educational AI literacy tool).
        function heuristicFallbackIntent(text, recentMessages = []) {
            if (!expertMode) return 'general';
            const t = (text || '').toLowerCase();

            // [pattern, weight]
            const ethicsRules = [
                [/(隐私|privacy)/i, 3],
                [/(偏见|bias|歧视|discrimination)/i, 3],
                [/(版权|copyright|知识产权|intellectual property)/i, 3],
                [/(合规|compliance|法规|regulation|gdpr)/i, 3],
                [/(学术不端|抄袭|plagiarism|作弊|cheating)/i, 3],
                [/(伦理|ethics|道德|moral)/i, 2],
                [/(数据泄露|data.?leak|信息安全|cybersecurity)/i, 2],
                [/(安全(风险|问题|隐患)|safety risk)/i, 2],
                [/(滥用|misuse|欺骗|deceive|manipulation)/i, 2],
                [/(风险|risk|danger|危险)/i, 1],
                [/(如何避免|是否合法|违规|违法|is it ok to)/i, 1],
            ];
            const techRules = [
                [/(代码|code|coding)/i, 3],
                [/(编程|programming|开发|development)/i, 3],
                [/(算法|algorithm)/i, 3],
                [/(debug|调试|报错|错误|error|exception|bug)/i, 2],
                [/(api|接口|endpoint|interface)/i, 2],
                [/(数据库|database|sql|nosql|mongodb)/i, 2],
                [/(python|javascript|typescript|java|c\+\+|golang|rust|react|vue|next\.?js)/i, 2],
                [/(函数|function|方法|method|class|类|模块|module)/i, 2],
                [/(模型|model|训练|training|神经网络|neural|llm|gpt|fine.?tun)/i, 2],
                [/(部署|deploy|服务器|server|docker|kubernetes|cloud|云)/i, 2],
                [/(框架|framework|库|library|package|依赖|dependency)/i, 1],
                [/(性能|performance|优化|optimize|缓存|cache)/i, 1],
                [/(测试|test|unit test|integration)/i, 1],
            ];
            const pedagogyRules = [
                // Specific pedagogical context
                [/(教学|teaching|pedagogy|instructional design)/i, 3],
                [/(课堂|classroom|课程|curriculum|syllabus)/i, 3],
                [/(学习目标|learning objective|教学目标|competency)/i, 3],
                [/(教案|lesson plan|备课|课程设计)/i, 3],
                [/(评估|assessment|评价|evaluation|考试|exam|rubric|评分)/i, 2],
                [/(学生|student|学习者|learner)/i, 2],
                [/(教育|education|pedagogy|instructional)/i, 2],
                [/(如何解释|怎么讲|怎样教|how to teach|how to explain)/i, 2],
                [/(认知|cognition|bloom|metacognition|scaffold)/i, 2],
                [/(练习|practice|作业|homework|活动|activity|workshop)/i, 1],
                // Broad conceptual/explanatory signals — catches most general questions
                [/(什么是|是什么|定义|概念|原理|知识点)/i, 2],
                [/(解释|介绍|说明|阐述|explain|describe|overview)/i, 2],
                [/(为什么|why|原因|reason|背后)/i, 1],
                [/(如何|怎么|怎样|how to|how do|how does)/i, 1],
                [/(理解|understand|掌握|学会|搞懂)/i, 1],
                [/(区别|difference|比较|compare|versus|vs\.?|对比)/i, 1],
                [/(举例|example|案例|instance|比如|例如)/i, 1],
                [/(总结|summary|归纳|overview|综述)/i, 1],
                [/(历史|history|起源|发展|背景|context)/i, 1],
            ];

            const score = { tech: 0, pedagogy: 0, ethics: 0 };
            for (const [pat, w] of ethicsRules)   if (pat.test(t)) score.ethics   += w;
            for (const [pat, w] of techRules)     if (pat.test(t)) score.tech     += w;
            for (const [pat, w] of pedagogyRules) if (pat.test(t)) score.pedagogy += w;

            // Context continuity: boost the expert used in recent turns
            const recentAgents = (recentMessages || [])
                .slice(-4)
                .filter(m => m.agentId && m.agentId !== 'general')
                .map(m => m.agentId);
            if (recentAgents.length > 0) {
                const last = recentAgents[recentAgents.length - 1];
                if (score[last] !== undefined) score[last] += 0.8;
            }

            // Ethics always wins when strongly signalled (safety-first)
            if (score.ethics >= 3) return 'ethics';

            const best = Object.entries(score).sort((a, b) => b[1] - a[1]);
            // Always route to the highest-scoring expert; default to pedagogy if all scores are 0
            return best[0][1] > 0 ? best[0][0] : 'pedagogy';
        }

        async function detectIntentSemantic(text, timeoutMs = SEMANTIC_ROUTING_TIMEOUT_MS) {
            if (!expertMode) {
                return { agentId: 'general', reason: 'plain_mode' };
            }
            if (!ENABLE_SEMANTIC_ROUTING) {
                return { agentId: heuristicFallbackIntent(text, messageHistory), reason: 'heuristic_only' };
            }

            const apiBase = window.location.hostname === 'localhost' && window.location.port !== '80' && window.location.port !== ''
                ? 'http://localhost:8000'
                : '';

            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), Math.max(300, timeoutMs));
                const recent_messages = messageHistory.slice(-6).map(msg => ({
                    role: (msg.role === 'ai' || msg.role === 'assistant') ? 'assistant' : msg.role,
                    content: msg.content
                }));
                let resp;
                try {
                    resp = await fetch(`${apiBase}/api/chat/classify-intent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        body: JSON.stringify({
                            text,
                            recent_messages,
                            available_agents: availableAgentIds,
                            session_id: sessionId || null,
                            round_no: messageHistory.filter(m => m.role === 'user').length + 1
                        })
                    });
                } finally {
                    clearTimeout(timer);
                }

                if (!resp.ok) throw new Error(`classify failed ${resp.status}`);
                const data = await resp.json();
                const fallback = heuristicFallbackIntent(text, messageHistory);
                // Never use 'general' in expert mode — if API returns it, defer to heuristic specialist
                const raw = data.agent_id;
                const chosen = (agents[raw] && raw !== 'general') ? raw : fallback;
                return { agentId: chosen, reason: data.reason || '' };
            } catch (error) {
                console.warn('Semantic routing fallback:', error);
                return { agentId: heuristicFallbackIntent(text, messageHistory), reason: 'fallback' };
            }
        }

        function switchAgent(agentId) {
            if (currentAgent.id === agentId) return;
            
            const newAgent = agents[agentId];
            currentAgent = newAgent;
            
            // UI Feedback for Switching
            showSwitchNotification(newAgent);
            updateHeaderUI(newAgent);
        }

        function showSwitchNotification(agent) {
            if (!expertMode) return;
            const notif = document.createElement('div');
            notif.className = "flex justify-center animate-[fadeIn_0.5s_ease-out]";
            notif.innerHTML = `
                <div class="flex items-center gap-2 bg-surface-dark border ${agent.border_color} px-4 py-2 rounded-full shadow-lg">
                    <span class="material-symbols-outlined ${agent.color} text-sm">swap_horiz</span>
                    <span class="text-xs text-gray-300">Switching to <span class="${agent.color} font-bold">${agent.name}</span></span>
                </div>
            `;
            messagesContainer.appendChild(notif);
            scrollToBottom();
        }

        function updateHeaderUI(agent) {
            // Update Header Icon and Title
            // Note: This assumes specific header structure. Let's make it robust.
            const headerTitle = document.querySelector('header h2');
            const headerTag = document.querySelector('header span.uppercase');
            
            if(headerTitle) {
                // Keep the topic, maybe append Agent? Or just change color?
                // Let's change the "Learning Mode" indicator if it exists
                const modeBtn = document.querySelector('header button span.material-symbols-outlined').parentNode;
                if(modeBtn) {
                    // Update icon and text
                    const icon = modeBtn.querySelector('.material-symbols-outlined');
                    const text = modeBtn.childNodes[2]; // Assuming text node is 3rd (icon, space, text)
                    
                    if(icon) icon.textContent = agent.avatar_icon;
                    // Reset classes
                    modeBtn.className = `bg-surface-dark text-white rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1 shadow-sm border ${agent.border_color}`;
                    // Special styling for active agent
                     if(agent.id !== 'general') {
                         modeBtn.classList.remove('bg-surface-dark');
                         // We can't easily add arbitrary tailwind classes if they aren't compiled, 
                         // but we can use style attribute or known classes.
                         // Let's use simple border and text color.
                         icon.className = `material-symbols-outlined text-[16px] ${agent.color}`;
                     }
                }
            }
        }

        // Helper to find button by icon text
        function findButtonByIcon(iconName) {
            return Array.from(document.querySelectorAll('button .material-symbols-outlined'))
                .find(el => el.textContent.trim() === iconName)
                ?.closest('button');
        }

        // Buttons
        const quickActionBtns = document.querySelectorAll('.flex.gap-2.overflow-x-auto button');
        const newSessionBtn = findButtonByIcon("add");
        const attachBtn = findButtonByIcon("add_circle");
        const micBtn = findButtonByIcon("mic");

        // Initial session setup
        let sessionId = "session_" + Date.now();
        let messageHistory = [];
        let currentUserName = "Learner";
        let isLoggedIn = false;


        // Hide typing indicator initially
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }

        function initModeBadge() {
            const headerRight = document.querySelector('header .flex.items-center.gap-3');
            if (!headerRight) return;
            // Remove existing badge to stay idempotent (called after each login).
            const existing = document.getElementById('mode-badge');
            if (existing) existing.remove();
            const badge = document.createElement('span');
            badge.id = 'mode-badge';
            badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide';
            if (expertMode) {
                badge.classList.add('text-primary', 'border-primary/40', 'bg-primary/10');
                badge.textContent = '四专家版';
            } else {
                badge.classList.add('text-gray-300', 'border-surface-border', 'bg-surface-dark');
                badge.textContent = '无专家版';
            }
            headerRight.prepend(badge);
        }
        // initModeBadge() is called inside completeLogin() after expertMode is set.

        async function sendMessage(text = null) {
            const content = text || chatInput.value.trim();
            if (!content) return;
            if (!sessionId) sessionId = "session_" + Date.now();

            // 1. Append user message to UI and history immediately
            appendUserMessage(content);
            chatInput.value = '';
            messageHistory.push({ role: "user", content });
            upsertLocalSessionSnapshot();
            renderSidebar();
            saveCurrentSession().catch(e => console.warn("optimistic save failed:", e));

            // 2. Pick agent instantly via heuristic (zero latency) — no waiting for LLM routing
            const heuristicId = heuristicFallbackIntent(content, messageHistory);
            if (heuristicId !== currentAgent.id) switchAgent(heuristicId);
            const responseAgent = currentAgent;

            // 3. Build API payload — normalize all roles to system/user/assistant
            const _toApiRole = r => (['ai','assistant','expert'].includes(r) ? 'assistant' : r);
            const apiMessageHistory = messageHistory.map(msg => ({
                role: _toApiRole(msg.role),
                content: msg.content
            }));
            apiMessageHistory.unshift({ role: "system", content: responseAgent.system_prompt });

            // 4. Show typing indicator right away
            if (typingIndicator) {
                typingIndicator.style.display = 'flex';
                messagesContainer.appendChild(typingIndicator);
                scrollToBottom();
            }

            // 5. Fire semantic routing in background — non-blocking.
            //    Updates currentAgent for the NEXT message if the LLM picks a different expert.
            if (expertMode) {
                detectIntentSemantic(content).then(routing => {
                    const semanticId = routing.agentId || heuristicId;
                    if (semanticId !== responseAgent.id && agents[semanticId]) {
                        // Silent update for next turn; current in-flight request uses heuristic agent.
                        currentAgent = agents[semanticId];
                    }
                }).catch(() => {});
            }

            // 6. Send chat request with exponential-backoff retry
            const apiBase = getApiBase();
            const payload = {
                session_id: sessionId,
                messages: apiMessageHistory,
                user_name: currentUserName,
                expert_role: responseAgent.id,
                max_tokens: responseAgent.id === 'general' ? 220 : 180
            };

            try {
                let data = null;
                let lastError = null;
                const maxAttempts = 3;

                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        const controller = new AbortController();
                        const timer = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
                        let response;
                        try {
                            response = await fetch(`${apiBase}/api/chat/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                signal: controller.signal,
                                body: JSON.stringify(payload)
                            });
                        } finally {
                            clearTimeout(timer);
                        }
                        if (!response.ok) {
                            const errText = await response.text();
                            throw new Error(`Server responded with ${response.status}: ${errText}`);
                        }
                        data = await response.json();
                        lastError = null;
                        break;
                    } catch (err) {
                        lastError = err;
                        console.warn(`Chat request failed (attempt ${attempt}/${maxAttempts}):`, err);
                        if (attempt < maxAttempts) {
                            // Exponential backoff: 500ms, 1000ms
                            await new Promise(r => setTimeout(r, 500 * attempt));
                        }
                    }
                }

                if (lastError || !data) throw lastError || new Error("Chat response is empty");

                if (typingIndicator) typingIndicator.style.display = 'none';
                await appendAIMessageStream(data.response || "", responseAgent);
                messageHistory.push({ role: "assistant", content: data.response, agentId: responseAgent.id });
                await saveCurrentSession();

            } catch (error) {
                console.error('Error:', error);
                if (typingIndicator) typingIndicator.style.display = 'none';
                const fallback = "抱歉，当前连接不稳定。请再试一次；若持续失败请刷新页面并重启后端。";
                appendAIMessage(fallback, responseAgent);
                messageHistory.push({ role: "assistant", content: fallback, agentId: responseAgent.id });
                await saveCurrentSession();
            }
        }

        function appendUserMessage(text) {
            const msgDiv = document.createElement('div');
            msgDiv.className = "flex items-start gap-4 flex-row-reverse animate-[fadeIn_0.5s_ease-out_both]";
            msgDiv.innerHTML = `
                <div class="size-10 rounded-full bg-gradient-to-br from-orange-400 to-yellow-600 shrink-0 shadow-lg" data-alt="User avatar"></div>
                <div class="flex flex-col gap-1.5 items-end max-w-[85%]">
                    <span class="text-sm font-bold text-white">你</span>
                    <div class="bg-primary text-background-dark px-5 py-4 rounded-2xl rounded-tr-none shadow-md font-medium leading-relaxed">
                        <p>${escapeHtml(text)}</p>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(msgDiv);
            scrollToBottom();
        }

        // Shared AI message bubble builder
        function _buildAIMessageEl(agent) {
            const displayAgent = expertMode ? (agent || currentAgent) : agents.general;
            // Only show role badge for non-general expert agents
            const roleBadge = (expertMode && displayAgent.id !== 'general')
                ? `<span class="text-[10px] font-normal px-1.5 py-0.5 rounded-full border ${displayAgent.border_color} ${displayAgent.color} bg-surface-dark/50 uppercase tracking-wider">${displayAgent.role}</span>`
                : '';
            const msgDiv = document.createElement('div');
            msgDiv.className = "flex items-start gap-4 animate-[fadeIn_0.5s_ease-out_both]";
            msgDiv.innerHTML = `
                <div class="size-10 rounded-full bg-surface-dark border ${displayAgent.border_color} flex items-center justify-center shrink-0 shadow-lg group relative">
                    <span class="material-symbols-outlined ${displayAgent.color} text-xl">${displayAgent.avatar_icon}</span>
                    <div class="absolute -bottom-1 -right-1 size-3 bg-surface-dark rounded-full border border-surface-border flex items-center justify-center">
                        <span class="size-1.5 rounded-full ${displayAgent.color.replace('text-', 'bg-')}"></span>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5 max-w-[85%]">
                    <span class="text-sm font-bold text-white flex items-center gap-2">
                        ${displayAgent.name}${roleBadge}
                    </span>
                    <div class="bg-surface-dark text-gray-100 px-5 py-4 rounded-2xl rounded-tl-none border border-surface-border shadow-sm leading-relaxed message-content"></div>
                    <div class="flex gap-2 mt-1">
                        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dark hover:bg-surface-border text-xs font-medium text-gray-400 hover:text-white transition-colors btn-like">
                            <span class="material-symbols-outlined text-[16px]">thumb_up</span>
                            <span>有帮助</span>
                        </button>
                        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-dark hover:bg-surface-border text-xs font-medium text-gray-400 hover:text-white transition-colors btn-copy">
                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                            <span>复制</span>
                        </button>
                    </div>
                </div>
            `;
            return msgDiv;
        }

        function appendAIMessage(text, agent = null) {
            const msgDiv = _buildAIMessageEl(agent);
            msgDiv.querySelector('.message-content').innerHTML = parseMarkdown(text);
            messagesContainer.appendChild(msgDiv);
            scrollToBottom();
        }

        async function appendAIMessageStream(text, agent = null) {
            const answer = (text || "").trim();
            const msgDiv = _buildAIMessageEl(agent);
            const contentEl = msgDiv.querySelector('.message-content');
            messagesContainer.appendChild(msgDiv);
            scrollToBottom();

            // Simulate streaming: batch updates via requestAnimationFrame
            const chunks = [];
            for (let i = 0; i < answer.length; i += STREAM_CHUNK_SIZE) {
                chunks.push(answer.slice(i, i + STREAM_CHUNK_SIZE));
            }
            let current = "";
            for (const c of chunks) {
                current += c;
                await new Promise(resolve => setTimeout(resolve, STREAM_DELAY_MS));
                contentEl.textContent = current;
                scrollToBottom();
            }
            contentEl.innerHTML = parseMarkdown(answer || "我已完成回答。");
            scrollToBottom();
        }

        function scrollToBottom() {
            chatContainer.scrollTo({
                top: chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Code block renderer for marked — called once at init
        function _renderCodeBlock(code, lang) {
            const language = lang && hljs.getLanguage(lang) ? lang : '';
            const highlighted = language
                ? hljs.highlight(code, { language }).value
                : hljs.highlightAuto(code).value;
            const displayLang = language || 'code';
            return '<div class="code-block-wrapper">' +
                '<div class="code-block-header">' +
                    '<span class="code-block-lang">' + displayLang + '</span>' +
                    '<button class="code-block-copy" onclick="(function(btn){' +
                        'var c=btn.closest(\'.code-block-wrapper\').querySelector(\'code\').innerText;' +
                        'navigator.clipboard.writeText(c).then(function(){' +
                            'btn.textContent=\'✓ 已复制\';' +
                            'setTimeout(function(){btn.innerHTML=\'<span class=\\\'material-symbols-outlined\\\' style=\\\'font-size:13px\\\'>content_copy</span> 复制\';},1500);' +
                        '});' +
                    '})(this)">' +
                        '<span class="material-symbols-outlined" style="font-size:13px">content_copy</span> 复制' +
                    '</button>' +
                '</div>' +
                '<pre><code class="hljs">' + highlighted + '</code></pre>' +
            '</div>';
        }
        marked.use({
            breaks: true,
            gfm: true,
            renderer: {
                code(token) {
                    // marked v5+: token is an object {text, lang}
                    if (token && typeof token === 'object' && 'text' in token) {
                        return _renderCodeBlock(token.text, token.lang || '');
                    }
                    // marked v4: (code, lang) — token is the code string
                    return _renderCodeBlock(String(token), '');
                }
            }
        });

        // Advanced Parser with Markdown and KaTeX Support
        function parseMarkdown(text) {
            // 1. Pre-process Math to protect it from Markdown parser
            const mathSegments = [];

            const storeMath = (math, displayMode) => {
                const id = `@@MATH_${mathSegments.length}@@`;
                try {
                    const html = katex.renderToString(math, {
                        displayMode: displayMode,
                        throwOnError: false
                    });
                    mathSegments.push({ id, html });
                    return id;
                } catch (e) {
                    console.error("KaTeX error:", e);
                    return math;
                }
            };

            // Replace Display Math \[ ... \]
            let processedText = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => storeMath(math, true));

            // Replace Display Math $$ ... $$
            processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => storeMath(math, true));

            // Replace Inline Math \( ... \)
            processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => storeMath(math, false));

            // Replace Inline Math $ ... $ (skip digit-prefixed to avoid catching prices like $5)
            processedText = processedText.replace(/(?<!\d)\$(?!\s)([^\$\n]+?)(?<!\s)\$/g, (match, math) => storeMath(math, false));

            // 2. Parse Markdown
            let html = marked.parse(processedText);

            // 3. Restore Math
            mathSegments.forEach(segment => {
                html = html.replace(segment.id, segment.html);
            });

            return html;
        }



        // Removed old saveCurrentSessionToSidebar function as it's replaced by renderSidebar logic
        // But need to keep the function definition or remove it. Let's remove it in the replacement.

        // Event Delegation for Messages (Handles both static and dynamic buttons)
        messagesContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Handle Like
            if (btn.querySelector('.material-symbols-outlined').textContent.trim() === 'thumb_up' || btn.classList.contains('btn-like')) {
                handleFeedback(btn);
            }

            // Handle Copy
            if (btn.querySelector('.material-symbols-outlined').textContent.trim() === 'content_copy' || btn.classList.contains('btn-copy')) {
                // Find the message content
                // Structure: button -> div (actions) -> div (wrapper) -> div (message-content)
                // Or: button container is next sibling of message content
                const actionContainer = btn.parentElement;
                const messageWrapper = actionContainer.parentElement;
                // Try to find the content div. 
                // For dynamic messages I added 'message-content' class.
                // For static messages, we might need to rely on structure.
                let contentDiv = messageWrapper.querySelector('.message-content');
                if(!contentDiv) {
                     // Fallback for old static structure or portal view if needed
                     contentDiv = messageWrapper.querySelector('.bg-surface-dark.text-gray-100');
                }
                
                if (contentDiv) {
                    const text = contentDiv.innerText;
                    copyToClipboard(btn, text);
                }
            }
        });

        function handleFeedback(btn) {
            const icon = btn.querySelector('.material-symbols-outlined');
            btn.classList.toggle('text-primary');
            icon.classList.toggle('fill-current'); 
            
            const textSpan = btn.querySelector('span:last-child');
            if (textSpan) {
                textSpan.textContent = btn.classList.contains('text-primary') ? '已点赞' : '有帮助';
            }
        }

        function copyToClipboard(btn, text) {
            navigator.clipboard.writeText(text).then(() => {
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">check</span> <span>已复制</span>';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Quick Actions
        quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.querySelector('span:last-child').textContent;
                sendMessage(text);
            });
        });

        // New Session
        // Note: The selector might be tricky because there are multiple buttons.
        // Let's find the one with "新会话" text or "add" icon in aside
        const sidebarButtons = document.querySelectorAll('aside button');
        sidebarButtons.forEach(btn => {
            if(btn.textContent.includes('新会话')) {
                btn.addEventListener('click', handleNewSession);
            }
        });

        // Attach & Mic (Mock)
        if(attachBtn) {
            attachBtn.addEventListener('click', () => alert('附件上传功能即将上线！'));
        }
        if(micBtn) {
            micBtn.addEventListener('click', () => alert('语音输入功能即将上线！'));
        }

        // --- Cloud Persistence Logic ---
        const sessionStore = {};

        function getApiBase() {
            return window.location.hostname === 'localhost' && window.location.port !== '80' && window.location.port !== ''
                ? 'http://localhost:8000'
                : '';
        }

        async function refreshSessionsFromCloud() {
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/api/chat/sessions`);
            if (!response.ok) throw new Error(`Failed to fetch sessions: ${response.status}`);
            const list = await response.json();

            const remoteIds = new Set();
            list.forEach((s) => {
                remoteIds.add(s.session_id);
                const existing = sessionStore[s.session_id] || {};
                sessionStore[s.session_id] = {
                    id: s.session_id,
                    // Prefer local derived title if present; fallback to server preview.
                    title: existing.title || s.title || s.preview || s.session_id,
                    tag: "历史记录",
                    user_name: s.user_name || existing.user_name || "Learner",
                    messages: existing.messages || [],
                    timestamp: Math.max(existing.timestamp || 0, (s.timestamp || 0) * 1000)
                };
            });

            // Do not wipe local optimistic sessions immediately; keep them in sidebar
            // to prevent disappear/reappear flicker when cloud sync is delayed.
            Object.keys(sessionStore).forEach((sid) => {
                if (!remoteIds.has(sid) && sid !== sessionId) {
                    const item = sessionStore[sid];
                    const hasLocalMessages = Array.isArray(item?.messages) && item.messages.length > 0;
                    const recent = (Date.now() - (item?.timestamp || 0)) < 30 * 60 * 1000;
                    if (!hasLocalMessages || !recent) {
                        delete sessionStore[sid];
                    }
                }
            });
        }

        async function saveCurrentSession() {
            upsertLocalSessionSnapshot();
            try {
                await syncCurrentSessionToCloud();
            } catch (error) {
                console.warn("saveCurrentSession sync failed:", error);
            }
            try {
                await refreshSessionsFromCloud();
            } catch (error) {
                console.warn("saveCurrentSession skipped cloud refresh:", error);
            }
            renderSidebar();
        }

        async function syncCurrentSessionToCloud() {
            if (!sessionId) return;
            const apiBase = getApiBase();
            const payload = {
                session_id: sessionId,
                user_name: currentUserName,
                messages: messageHistory.map((m) => ({
                    role: (m.role === 'ai') ? 'assistant' : m.role,
                    content: m.content,
                    agentId: m.agentId || null
                }))
            };
            const response = await fetch(`${apiBase}/api/chat/sync-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`sync-session failed ${response.status}: ${errText}`);
            }
            if (sessionStore[sessionId]) {
                sessionStore[sessionId].local_only = false;
            }
        }

        function upsertLocalSessionSnapshot() {
            if (!sessionId) return;
            const firstUser = messageHistory.find((m) => m.role === 'user');
            const localTitle = (firstUser?.content || "新会话")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 24);
            const existing = sessionStore[sessionId] || {};
            sessionStore[sessionId] = {
                id: sessionId,
                title: localTitle || existing.title || "新会话",
                tag: "历史记录",
                user_name: currentUserName,
                messages: [...messageHistory],
                timestamp: Date.now(),
                local_only: true
            };
        }
        
        // --- Sidebar Logic ---
        
        async function deleteSession(id) {
            // Snapshot for rollback
            const snapshot = sessionStore[id];
            const wasActive = sessionId === id;

            // Optimistic local removal
            delete sessionStore[id];
            if (wasActive) {
                sessionId = null;
                messageHistory = [];
                showPortal();
            }
            renderSidebar();

            try {
                const apiBase = getApiBase();
                const resp = await fetch(`${apiBase}/api/chat/session/${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.detail || `HTTP ${resp.status}`);
                }
            } catch (e) {
                console.error('Delete session failed:', e);
                // Rollback local removal
                if (snapshot) sessionStore[id] = snapshot;
                if (wasActive) {
                    sessionId = id;
                    messageHistory = snapshot?.messages || [];
                }
                renderSidebar();
                alert('删除失败：' + e.message);
            }
        }

        function renderSidebar() {
            const nav = document.getElementById('sidebar-nav');
            if (!nav) return;
            nav.innerHTML = '';

            const sortedSessions = Object.values(sessionStore).sort((a, b) => b.timestamp - a.timestamp);
            if (sortedSessions.length === 0) {
                nav.innerHTML = '<p class="px-4 py-3 text-xs text-gray-600">暂无历史记录</p>';
                return;
            }

            sortedSessions.forEach(session => {
                const item = document.createElement('div');
                const isActive = session.id === sessionId;
                item.className = isActive
                    ? "group flex items-center gap-3 px-4 py-3 rounded-full bg-surface-dark border border-surface-border text-white cursor-pointer transition-colors"
                    : "group flex items-center gap-3 px-4 py-3 rounded-full text-gray-400 hover:bg-surface-dark/50 hover:text-white cursor-pointer transition-colors";
                item.dataset.sessionId = session.id;

                const iconClass = isActive ? "text-primary shrink-0" : "shrink-0";
                item.innerHTML = `
                    <span class="material-symbols-outlined text-[20px] ${iconClass}">chat_bubble_outline</span>
                    <span class="text-sm font-medium truncate flex-1">${escapeHtml(session.title)}</span>
                    <button class="delete-session-btn shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all" title="删除会话">
                        <span class="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                `;

                item.querySelector('.delete-session-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                });

                item.addEventListener('click', async () => {
                    await switchToSession(session.id);
                });

                nav.appendChild(item);
            });
        }

        async function switchToSession(id) {
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/api/chat/session/${encodeURIComponent(id)}`);
            if (!response.ok) {
                console.error(`Failed to load session ${id}:`, response.status);
                return;
            }
            const sessionData = await response.json();
            sessionId = id;
            messageHistory = [...sessionData.messages];
            if (sessionData.user_name) {
                applyUserName(sessionData.user_name);
            }
            showChat();
            renderSidebar();
            loadSession({
                title: (sessionData.title || sessionData.messages.find(m => m.role === 'user')?.content || id).slice(0, 20),
                tag: "历史记录",
                messages: sessionData.messages
            });
                
            if (window.innerWidth < 768) closeMobileSidebar();
        }

        (async function initPersistence() {
             try {
                await refreshSessionsFromCloud();
             } catch (error) {
                console.warn("Cloud sessions init failed:", error);
             }
             renderSidebar();
             if (isLoggedIn) {
                 applyUserName(currentUserName);
                 showPortal();
             } else {
                 openLogin();
             }
        })();

        // --- End Cloud Persistence Logic ---

        // --- View Switching Logic ---
        
        const portalView = document.getElementById('portal-view');
        const chatView = document.getElementById('chat-view');
        const portalInput = document.getElementById('portal-input');
        
        function showPortal() {
            if (!isLoggedIn) {
                openLogin();
                return;
            }
            portalView.classList.remove('hidden');
            portalView.classList.add('flex');
            chatView.classList.add('hidden');
            chatView.classList.remove('flex');
            
            // Clear inputs
            portalInput.value = '';
            chatInput.value = '';
        }

        function showChat() {
            if (!isLoggedIn) {
                openLogin();
                return;
            }
            portalView.classList.add('hidden');
            portalView.classList.remove('flex');
            chatView.classList.remove('hidden');
            chatView.classList.add('flex');
            
            // Focus chat input if needed, or just scroll
            scrollToBottom();
        }

        function sendPortalMessage(text = null) {
            if (!isLoggedIn) {
                openLogin();
                return;
            }
            const content = text || portalInput.value.trim();
            if (!content) return;

            // 1. Switch to Chat View
            showChat();
            
            // 2. Start New Session (if not already clean)
            // handleNewSession() clears messages, but we want to start with this message.
            // If we are coming from Portal, it's essentially a new session.
            
            // Reset Session
            sessionId = "session_" + Date.now();
            messageHistory = [];
            upsertLocalSessionSnapshot();
            
            // Update header to reflect new conversation topic
            if (headerTitle) headerTitle.textContent = content.length > 24 ? content.slice(0, 24) + '…' : content;
            if (headerTag) headerTag.textContent = '对话中';

            messagesContainer.innerHTML = '';
            
            // Add Timestamp
            const timeDiv = document.createElement('div');
            timeDiv.className = "flex justify-center";
            timeDiv.innerHTML = '<span class="text-xs font-medium text-gray-500 bg-surface-dark/50 px-3 py-1 rounded-full">今天, ' + new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'}) + '</span>';
            messagesContainer.appendChild(timeDiv);

            // 3. Send Message
            sendMessage(content);
            
            // 4. Update Sidebar (active state)
            renderSidebar();
        }

        // Portal Input Event
        portalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendPortalMessage();
            }
        });

        // --- End View Switching Logic ---

        // Modified handleNewSession to show Portal
        function handleNewSession() {
             if (!isLoggedIn) {
                 openLogin();
                 return;
             }
             // Save current session logic...
             if (messageHistory.length > 0) {
                 saveCurrentSession();
             }
             
             // Reset session ID? Or wait until portal input?
             // Gemin/ChatGPT behavior: New Chat button just shows blank welcome screen. 
             // Session is created when first message is sent.
             // But we need to update sidebar active state to "None" or "New"?
             sessionId = null; // No active session yet
             
             renderSidebar(); // Will show no active link
             showPortal();
        }

        // switchToSession/initPersistence are defined in cloud persistence section

        // --- Selectors ---
        const navLinks = document.querySelectorAll('aside nav a'); // Legacy selectors, might need cleanup

        const headerTitle = document.getElementById('chat-header-title');
        const headerTag = document.getElementById('chat-header-tag');
        const mobileMenuBtn = document.querySelector('.md\\:hidden button');
        const sidebar = document.querySelector('aside');
        const sidebarBottomSection = document.querySelector('aside > div:last-child');
        const settingsButton = sidebarBottomSection ? sidebarBottomSection.querySelector('button') : null;
        const profileDiv = sidebarBottomSection ? sidebarBottomSection.querySelector('div.cursor-pointer, div.flex.items-center.gap-3') : null;
        const statusDiv = document.querySelector('aside .group.cursor-help');

        // Modal Logic
        window.toggleModal = function(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            if (modal.classList.contains('hidden')) {
                // Show
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                // Trigger reflow for transition
                void modal.offsetWidth;
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
                modal.querySelector('div').classList.add('scale-100');
            } else {
                // Hide
                modal.classList.add('opacity-0');
                modal.querySelector('div').classList.remove('scale-100');
                modal.querySelector('div').classList.add('scale-95');
                
                setTimeout(() => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }, 300);
            }
        };

        // Close modal on outside click
        document.querySelectorAll('.fixed.inset-0.bg-black\\/80').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    toggleModal(overlay.id);
                }
            });
        });

        // Mobile Menu Toggle
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        function openMobileSidebar() {
            sidebar.classList.remove('hidden');
            sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50', 'w-72');
            if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
        }
        function closeMobileSidebar() {
            sidebar.classList.add('hidden');
            sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50', 'w-72');
            if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
        }
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                if (sidebar.classList.contains('hidden')) {
                    openMobileSidebar();
                } else {
                    closeMobileSidebar();
                }
            });
        }
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeMobileSidebar);
        }

        // History Navigation
        // Removed old manual listener attachment as it's now handled in renderSidebar
        // navLinks.forEach(link => { ... });

        // Selectors Update (if needed, but we rely on dynamic creation now)

        function loadSession(data) {
            // Update Header
            if(headerTitle) headerTitle.textContent = data.title;
            if(headerTag) headerTag.textContent = data.tag;

            // Clear Messages
            messagesContainer.innerHTML = '';
            
            // Add Timestamp
            const timeDiv = document.createElement('div');
            timeDiv.className = "flex justify-center";
            timeDiv.innerHTML = '<span class="text-xs font-medium text-gray-500 bg-surface-dark/50 px-3 py-1 rounded-full">今天, ' + new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) + '</span>';
            messagesContainer.appendChild(timeDiv);

            // Add Messages
            data.messages.forEach(msg => {
                if(msg.role === 'ai' || msg.role === 'assistant' || msg.role === 'expert') {
                    const msgAgent = msg.agentId ? agents[msg.agentId] : agents.general;
                    appendAIMessage(msg.content, msgAgent);
                } else if (msg.role === 'user') {
                    appendUserMessage(msg.content);
                }
            });
            
            // Sync history
            messageHistory = [...data.messages]; // Clone
        }

        // Settings & Profile & Status
        if(settingsButton) {
            settingsButton.addEventListener('click', () => {
                toggleModal('settings-modal');
            });
        }
        
        if(profileDiv) {
            profileDiv.addEventListener('click', () => {
                // Populate stats from sessionStore before opening
                const statSessions = document.getElementById('profile-stat-sessions');
                const statMessages = document.getElementById('profile-stat-messages');
                if (statSessions) statSessions.textContent = Object.keys(sessionStore).length || '0';
                if (statMessages) {
                    const total = Object.values(sessionStore).reduce((sum, s) => sum + (s.messages?.length || 0), 0);
                    statMessages.textContent = total || '0';
                }
                toggleModal('profile-modal');
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                toggleModal('profile-modal');
                isLoggedIn = false;
                expertMode = false;
                currentAgent = agents.general;
                messageHistory = [];
                sessionId = null;
                currentUserName = 'Learner';
                localStorage.removeItem('maple_username');
                openLogin();
            });
        }

        // Portal mic button
        document.getElementById('portal-mic-btn')?.addEventListener('click', () => {
            alert('语音输入功能即将上线！');
        });

        if(statusDiv) {
            statusDiv.addEventListener('click', () => {
                toggleModal('status-modal');
                refreshStatusModal();
            });
        }

        async function refreshStatusModal() {
            const apiBase = getApiBase();
            const elHealth   = document.getElementById('status-health');
            const elProvider = document.getElementById('status-provider');
            const elModel    = document.getElementById('status-model');
            const elList     = document.getElementById('status-providers-list');
            const elNote     = document.getElementById('status-note');

            try {
                const t0 = Date.now();
                const resp = await fetch(`${apiBase}/api/status`);
                const latency = Date.now() - t0;
                if (!resp.ok) throw new Error(`${resp.status}`);
                const data = await resp.json();

                // Health dot
                const allDegraded = data.providers.every(p => p.degraded);
                if (allDegraded) {
                    elHealth.innerHTML = `<span class="size-2 rounded-full bg-red-400"></span><span class="text-red-400">降级运行</span>`;
                } else {
                    elHealth.innerHTML = `<span class="size-2 rounded-full bg-green-400 animate-pulse"></span><span class="text-green-400">正常运行 · ${latency}ms</span>`;
                }

                elProvider.textContent = data.active_provider || '—';
                elModel.textContent    = data.active_model    || '—';

                // Per-provider list
                elList.innerHTML = '';
                (data.providers || []).forEach(p => {
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between py-1.5 px-3 rounded-xl bg-surface-dark/60';
                    const dot = p.degraded
                        ? `<span class="size-2 rounded-full bg-red-400 mr-2 shrink-0"></span>`
                        : `<span class="size-2 rounded-full bg-green-400 mr-2 shrink-0"></span>`;
                    const badge = p.primary
                        ? `<span class="text-[10px] text-primary font-bold border border-primary/30 px-1.5 py-0.5 rounded-full ml-1">主</span>`
                        : '';
                    const failText = p.failures > 0
                        ? `<span class="text-red-400 text-xs font-mono ml-2">${p.failures} fail</span>`
                        : '';
                    row.innerHTML = `
                        <div class="flex items-center text-sm text-white">
                            ${dot}
                            <span class="font-medium">${p.name}</span>${badge}${failText}
                        </div>
                        <span class="text-xs text-gray-500 font-mono truncate max-w-[140px]">${p.model}</span>
                    `;
                    elList.appendChild(row);
                });

                elNote.textContent = `上次刷新：${new Date().toLocaleTimeString('zh-CN')}`;
            } catch (e) {
                elHealth.innerHTML = `<span class="size-2 rounded-full bg-red-400"></span><span class="text-red-400">无法连接后端</span>`;
                elNote.textContent = `错误：${e.message}`;
            }
        }

        function applyUserName(name) {
            const cleaned = (name || "").trim().slice(0, 50);
            currentUserName = cleaned || "Learner";
            if (portalUsername) portalUsername.textContent = `Hi ${currentUserName}`;
            if (sidebarUsername) sidebarUsername.textContent = `Hi！${currentUserName}`;
            if (profileUsername) profileUsername.textContent = `${currentUserName} 同学`;
            if (profileEmail) profileEmail.textContent = `${currentUserName.toLowerCase().replace(/\s+/g, ".")}@maple.local`;
        }

        // ── Mode card selection ───────────────────────────────────────────────
        let _selectedMode = 'expert'; // default

        function _setModeCard(mode) {
            _selectedMode = mode;
            const btnExpert = document.getElementById('mode-btn-expert');
            const btnPlain  = document.getElementById('mode-btn-plain');
            if (!btnExpert || !btnPlain) return;

            const activeClasses   = ['border-primary', 'bg-primary/10'];
            const inactiveClasses = ['border-surface-border', 'bg-surface-dark/60'];

            if (mode === 'expert') {
                activeClasses.forEach(c => btnExpert.classList.add(c));
                inactiveClasses.forEach(c => btnExpert.classList.remove(c));
                inactiveClasses.forEach(c => btnPlain.classList.add(c));
                activeClasses.forEach(c => btnPlain.classList.remove(c));
                const iconE = btnExpert.querySelector('.material-symbols-outlined');
                const iconP = btnPlain.querySelector('.material-symbols-outlined');
                if (iconE) { iconE.classList.remove('text-gray-400'); iconE.classList.add('text-primary'); }
                if (iconP) { iconP.classList.remove('text-primary'); iconP.classList.add('text-gray-400'); }
            } else {
                activeClasses.forEach(c => btnPlain.classList.add(c));
                inactiveClasses.forEach(c => btnPlain.classList.remove(c));
                inactiveClasses.forEach(c => btnExpert.classList.add(c));
                activeClasses.forEach(c => btnExpert.classList.remove(c));
                const iconE = btnExpert.querySelector('.material-symbols-outlined');
                const iconP = btnPlain.querySelector('.material-symbols-outlined');
                if (iconP) { iconP.classList.remove('text-gray-400'); iconP.classList.add('text-primary'); }
                if (iconE) { iconE.classList.remove('text-primary'); iconE.classList.add('text-gray-400'); }
            }
        }

        document.getElementById('mode-btn-expert')?.addEventListener('click', () => _setModeCard('expert'));
        document.getElementById('mode-btn-plain')?.addEventListener('click',  () => _setModeCard('plain'));
        // ─────────────────────────────────────────────────────────────────────

        function openLogin() {
            if (!loginOverlay) {
                isLoggedIn = true;
                showPortal();
                return;
            }
            loginOverlay.classList.remove('hidden');
            loginOverlay.classList.add('flex');
            portalView.classList.add('hidden');
            chatView.classList.add('hidden');
            if (loginUsernameInput) {
                // Pre-fill last username for convenience, but user must confirm.
                loginUsernameInput.value = _savedUsername;
                loginUsernameInput.focus();
            }
            _setModeCard('expert'); // reset to default selection each time
        }

        function completeLogin() {
            const raw = loginUsernameInput ? loginUsernameInput.value : "";
            const inputName = (raw || "").trim();
            if (!inputName) {
                if (loginError) loginError.classList.remove('hidden');
                return;
            }
            if (loginError) loginError.classList.add('hidden');

            // Apply selected mode
            expertMode       = (_selectedMode === 'expert');
            availableAgentIds = expertMode ? ['general', 'tech', 'pedagogy', 'ethics'] : ['general'];
            currentAgent     = agents.general;

            applyUserName(inputName);
            localStorage.setItem('maple_username', inputName);
            isLoggedIn = true;
            loginOverlay.classList.add('hidden');
            loginOverlay.classList.remove('flex');

            initModeBadge(); // update header badge with chosen mode
            renderSidebar(); // refresh sidebar with cloud sessions
            showPortal();
        }

        if (loginSubmitBtn) {
            loginSubmitBtn.addEventListener('click', completeLogin);
        }
        if (loginUsernameInput) {
            loginUsernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') completeLogin();
            });
        }



    
