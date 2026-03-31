    // Initialize Chart.js Radar Chart
    const ctx = document.getElementById('radarChart').getContext('2d');
    const radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['技术驾驭', '批判评估', '协同创造', '伦理责任'],
            datasets: [{
                label: '学生表现',
                data: [0, 0, 0, 0], // Initial Data
                backgroundColor: 'rgba(255, 224, 102, 0.3)',
                borderColor: '#ffe066',
                borderWidth: 2,
                pointBackgroundColor: '#ffe066',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#ffe066'
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { color: '#28392f' },
                    grid: { color: '#28392f' },
                    pointLabels: {
                        color: '#fff',
                        font: { size: 14, family: "'Spline Sans', sans-serif" }
                    },
                    min: 0,
                    max: 25,
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Load Sessions on Start
    document.addEventListener('DOMContentLoaded', fetchSessions);

    async function fetchSessions() {
        const listContainer = document.getElementById('session-list');
        listContainer.innerHTML = ''; // Clear loading state

        try {
            const apiBase = window.location.hostname === 'localhost' && window.location.port !== '80' && window.location.port !== '' 
                    ? 'http://localhost:8000' 
                    : '';
                
            try {
                const response = await fetch(`${apiBase}/api/chat/sessions`);
                if (!response.ok) throw new Error('Failed to fetch sessions');
                const sessions = await response.json();
                
                if (sessions.length === 0) {
                     listContainer.innerHTML = '<p class="text-gray-500 text-xs">暂无历史会话</p>';
                     return;
                }

                sessions.forEach(session => {
                    const date = new Date(session.timestamp * 1000).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                    
                    const item = document.createElement('div');
                    item.className = "bg-[#28392f]/50 hover:bg-[#28392f] border border-[#28392f] hover:border-primary/30 rounded-xl p-3 cursor-pointer transition-all group";
                    item.onclick = () => analyzeSession(session.session_id, item);
                    item.innerHTML = `
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-white text-xs font-bold truncate w-2/3">${session.title || session.session_id}</span>
                            <span class="text-[#9db9a8] text-[10px]">${date}</span>
                        </div>
                        <p class="text-gray-400 text-xs line-clamp-2 group-hover:text-gray-300 transition-colors">
                            ${session.preview}
                        </p>
                    `;
                    listContainer.appendChild(item);
                });
            } catch (backendError) {
                 console.warn("Backend sessions fetch failed:", backendError);
                 if (listContainer.children.length === 0) {
                     listContainer.innerHTML = '<p class="text-gray-500 text-xs">无法加载会话记录</p>';
                 }
            }

        } catch (error) {
            console.error(error);
            if (listContainer.children.length === 0) {
                 listContainer.innerHTML = '<p class="text-gray-500 text-xs">暂无历史会话</p>';
            }
        }
    }

    async function analyzeSession(sessionId, element) {
        // UI Feedback
        const originalContent = element.innerHTML;
        element.innerHTML = `
            <div class="flex items-center justify-center py-2 gap-2 text-primary">
                <span class="material-symbols-outlined animate-spin text-sm">refresh</span>
                <span class="text-xs font-bold">正在分析...</span>
            </div>
        `;
        
        // Disable all other items
        const allItems = document.querySelectorAll('#session-list > div');
        allItems.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));
        element.classList.remove('opacity-50');

        try {
            // Use relative path or conditional base
                const apiBase = window.location.hostname === 'localhost' && window.location.port !== '80' && window.location.port !== '' 
                    ? 'http://localhost:8000' 
                    : '';

                // 1) Load conversation content from DB and render on dashboard
                try {
                    const sessionResp = await fetch(`${apiBase}/api/chat/session/${encodeURIComponent(sessionId)}`);
                    if (sessionResp.ok) {
                        const sessionData = await sessionResp.json();
                        renderSessionMessages(sessionData.messages || []);
                    } else {
                        renderSessionMessages([]);
                    }
                } catch (sessionErr) {
                    console.warn("Load session detail failed:", sessionErr);
                    renderSessionMessages([]);
                }
                
                // 2) Analyze based on session_id (backend will read DB logs)
                const payload = { session_id: sessionId };

                const response = await fetch(`${apiBase}/api/analyze/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            updateDashboard(data);
            
            // Highlight active
            allItems.forEach(el => {
                el.classList.remove('bg-primary/20', 'border-primary');
                el.classList.add('bg-[#28392f]/50', 'border-[#28392f]');
            });
            element.classList.remove('bg-[#28392f]/50', 'border-[#28392f]');
            element.classList.add('bg-primary/10', 'border-primary');

        } catch (error) {
            console.error(error);
            alert('分析失败: ' + error.message);
        } finally {
            // Restore UI (but keep highlight if successful logic was added above, actually simpler to just restore content)
            // Ideally we keep the preview but show it's active.
            // For simplicity, let's just reload the list content for that item but keep active style
            element.innerHTML = originalContent; 
            allItems.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
        }
    }

    function renderSessionMessages(messages) {
        const box = document.getElementById('session-messages');
        if (!box) return;
        if (!messages || messages.length === 0) {
            box.innerHTML = '<p class="text-[#9db9a8]">未读取到会话内容。</p>';
            return;
        }
        box.innerHTML = messages.map((m, idx) => {
            const role = (m.role === 'user') ? '用户' : 'AI';
            const roleCls = (m.role === 'user') ? 'text-primary' : 'text-emerald-300';
            const content = String(m.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `
                <div class="rounded-lg border border-[#28392f] bg-surface-dark p-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="${roleCls}">${role}</span>
                        <span class="text-[10px] text-[#9db9a8]">#${idx + 1}</span>
                    </div>
                    <p class="text-gray-200 whitespace-pre-wrap leading-relaxed">${content}</p>
                </div>
            `;
        }).join('');
    }

    function updateDashboard(data) {
        // Map new backend keys to frontend display
        // Backend keys: know_understand, use_apply, evaluate_create, ethics
        // Frontend IDs: score-technical, score-evaluation, score-cocreativity, score-ethics
        
        // Use 0 for null values (No Evidence = 0)
        const formatScore = (val) => val === null ? 0 : val;
        
        // Helper to update score and tooltip/reasoning
        const updateScoreCard = (id, score, reasoning) => {
            const el = document.getElementById(id);
            el.innerText = formatScore(score);
            // Find parent card to add tooltip or reasoning display
            // For simplicity, let's append a small text below the subtitle if reasoning exists
            const card = el.closest('.group');
            let reasoningEl = card.querySelector('.reasoning-text');
            if (!reasoningEl) {
                reasoningEl = document.createElement('p');
                reasoningEl.className = "reasoning-text text-gray-500 text-[10px] mt-2 border-t border-white/5 pt-2 leading-tight hidden group-hover:block animate-[fadeIn_0.3s_ease-out]";
                card.appendChild(reasoningEl);
            }
            if (reasoning) {
                reasoningEl.innerText = reasoning;
            } else {
                reasoningEl.innerText = "无详细评估依据";
            }
        };

        updateScoreCard('score-technical', data.scores.use_apply, data.reasoning?.use_apply);
        updateScoreCard('score-evaluation', data.scores.know_understand, data.reasoning?.know_understand);
        updateScoreCard('score-cocreativity', data.scores.evaluate_create, data.reasoning?.evaluate_create);
        updateScoreCard('score-ethics', data.scores.ethics, data.reasoning?.ethics);

        // Calculate Total Score (Sum of valid scores)
        // If all are null (rare), 0.
        let sum = 0;
        let count = 0;
        
        // Iterate over the specific keys we care about
        const keys = ['use_apply', 'know_understand', 'evaluate_create', 'ethics'];
        keys.forEach(key => {
            if (data.scores[key] !== null) {
                sum += data.scores[key];
                // We sum them up. Since each is out of 25, total is out of 100.
                // We don't average them anymore because it's a 100-point scale sum.
                // Wait, previous request said "Total 100". 
                // Rubric says "0-25 per dimension".
                // So Total = Sum of all 4 dimensions.
            }
        });
        
        // If some are null, do we scale up? Or just treat as 0?
        // "If irrelevant, return null". If null, it shouldn't count against them? 
        // Or should we treat it as "0" evidence?
        // In "Evidence Based", No Evidence = Low Score (0-5).
        // Null is explicitly "Irrelevant".
        // Let's treat null as 0 for the Sum to keep it simple out of 100.
        // OR: If a dimension is null, the max score is reduced? e.g. out of 75.
        // Let's stick to Sum for now, assuming usually all 4 are present or we treat null as 0.
        
        document.getElementById('total-score').innerHTML = sum + '<span class="text-lg text-[#9db9a8] font-normal">/100</span>';

        // Update Comments
        const commentsDiv = document.getElementById('ai-comments');
        commentsDiv.innerText = data.comments;

        // Trajectory Features
        const tf = data.trajectory_features || {};
        document.getElementById('feat-diversity').innerText = (tf.dimension_diversity ?? 0).toFixed(3);
        document.getElementById('feat-jump-density').innerText = (tf.jump_density ?? 0).toFixed(3);
        document.getElementById('feat-ethics').innerText = tf.ethics_reached ? '是' : '否';
        document.getElementById('feat-longest-stay').innerText = `${tf.longest_stay_dimension || '--'} (${tf.longest_stay_rounds || 0}轮)`;
        document.getElementById('feat-pattern').innerText = `模式：${tf.pattern || '--'}`;

        // Turn Attributions
        const list = document.getElementById('attribution-list');
        const dimMap = {
            know_understand: 'Know&Understand',
            use_apply: 'Use&Apply',
            evaluate_create: 'Evaluate&Create',
            ethics: 'Ethics'
        };
        const attrs = data.turn_attributions || [];
        if (attrs.length === 0) {
            list.innerHTML = '<p class="text-[#9db9a8]">暂无归因结果</p>';
        } else {
            list.innerHTML = attrs.map(item => `
                <div class="rounded-lg border border-[#28392f] bg-surface-dark p-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-primary">第${item.turn_index}轮</span>
                        <span class="text-[10px] text-[#9db9a8]">${dimMap[item.dimension] || item.dimension}</span>
                    </div>
                    <p class="text-gray-300 line-clamp-2">${item.content || ''}</p>
                    <p class="text-[#9db9a8] mt-1">${item.reason || ''}</p>
                </div>
            `).join('');
        }

        // Update Chart
        // Radar chart needs values. Convert null to 0.
        const radarValues = [
            data.scores.use_apply || 0,        // Technical
            data.scores.know_understand || 0,  // Critical/Knowledge
            data.scores.evaluate_create || 0,  // Co-creation
            data.scores.ethics || 0            // Ethics
        ];
        radarChart.data.datasets[0].data = radarValues;
        radarChart.update();
    }
