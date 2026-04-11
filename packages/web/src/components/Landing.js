import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkle24Regular } from '@fluentui/react-icons';
const INSPIRATIONS = [
    "Movie night pick that settles disputes",
    "AI recipe finder from fridge photos",
    "Team standup bot that respects time zones",
    "Pet adoption matcher powered by AI",
    "Real-time air quality dashboard",
    "Neighborhood tool lending library",
    "Personal finance coach that speaks plain English",
    "Workout generator for hotel rooms",
    "Live event parking optimizer",
    "Study group matchmaker for college",
];
const TRACKS = [
    {
        id: 'web-app',
        icon: (<svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor">
        <path d="M14 2.5C7.649 2.5 2.5 7.649 2.5 14S7.649 25.5 14 25.5 25.5 20.351 25.5 14 20.351 2.5 14 2.5zM4.5 14c0-.687.076-1.355.22-2L10.5 17.5v1c0 1.38 1.12 2.5 2.5 2.5v2.35C8.44 22.8 4.5 18.87 4.5 14zm15.7 6.15c-.3-.93-1.15-1.65-2.2-1.65h-1v-3c0-.55-.45-1-1-1H9v-2h2c.55 0 1-.45 1-1V8h2c1.1 0 2-.9 2-2v-.42c3.28 1.3 5.5 4.43 5.5 8.42 0 2.35-.75 4.53-2.05 6.32l-.25-.17z"/>
      </svg>),
        title: 'Web App or API',
        desc: "Ship a web frontend, REST API, or microservice. Bring your code or start fresh — you'll get a working app, CI/CD pipeline, and a production URL.",
        prompt: "I want to build a web application",
    },
    {
        id: 'agentic-app',
        icon: (<svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor">
        <path d="M14 3a1 1 0 011 1v1.5h2.5A3.5 3.5 0 0121 9v2.05a2.5 2.5 0 010 4.9V18a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 017 18v-2.05a2.5 2.5 0 010-4.9V9a3.5 3.5 0 013.5-3.5H13V4a1 1 0 011-1zm-3 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
      </svg>),
        title: 'AI Agent',
        desc: 'Deploy an AI agent that calls tools, retrieves knowledge, and reasons over data. Self-host open-source models or connect to Azure OpenAI — with built-in scaling and low cost.',
        prompt: "I want to build an AI agent",
    },
];
const FRAMEWORKS = [
    { id: 'nextjs', label: 'Next.js' },
    { id: 'fastapi', label: 'Python FastAPI' },
    { id: 'express', label: 'Express.js' },
    { id: 'dotnet', label: '.NET' },
    { id: 'go', label: 'Go' },
    { id: 'spring', label: 'Spring Boot' },
    { id: 'django', label: 'Django' },
    { id: 'rust', label: 'Rust' },
    { id: 'langchain', label: 'LangChain Agent' },
    { id: 'rag', label: 'RAG App' },
];
export function Landing({ onStartChat, recentSessions, onResumeSession, onDeleteSession, onClearAllSessions }) {
    const [inputValue, setInputValue] = useState('');
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [placeholderVisible, setPlaceholderVisible] = useState(true);
    const [isHiding, setIsHiding] = useState(false);
    const inputRef = useRef(null);
    const [deletingId, setDeletingId] = useState(null);
    const [inspireLoading, setInspireLoading] = useState(false);
    const handleInspire = useCallback(async () => {
        setInspireLoading(true);
        setInputValue(''); // Clear input before streaming
        try {
            const res = await fetch('/api/inspirations?stream=true');
            if (!res.ok)
                throw new Error('API error');
            const reader = res.body?.getReader();
            if (!reader)
                throw new Error('No reader available');
            const decoder = new TextDecoder();
            let accumulatedText = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6); // Remove "data: " prefix
                        if (data === '[DONE]') {
                            setInspireLoading(false);
                            inputRef.current?.focus();
                            return;
                        }
                        accumulatedText += data;
                        setInputValue(accumulatedText);
                    }
                }
            }
            setInspireLoading(false);
            inputRef.current?.focus();
            return;
        }
        catch {
            // Fallback: pick from local INSPIRATIONS array
            setInspireLoading(false);
        }
        const pick = INSPIRATIONS[Math.floor(Math.random() * INSPIRATIONS.length)];
        setInputValue(pick);
        inputRef.current?.focus();
    }, []);
    // Rotate placeholder inspiration
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderVisible(false);
            setTimeout(() => {
                setPlaceholderIdx(prev => (prev + 1) % INSPIRATIONS.length);
                setPlaceholderVisible(true);
            }, 300);
        }, 4000);
        return () => clearInterval(interval);
    }, []);
    const handleSubmit = useCallback((prompt) => {
        if (!prompt.trim())
            return;
        setIsHiding(true);
        setTimeout(() => onStartChat(prompt.trim()), 350);
    }, [onStartChat]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(inputValue);
        }
    };
    // Auto-resize textarea (reset to 0 so scrollHeight shrinks properly)
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = '0';
            inputRef.current.style.height = Math.max(44, Math.min(inputRef.current.scrollHeight, 200)) + 'px';
        }
    }, [inputValue]);
    const handleDeleteClick = (e, sessionId) => {
        e.stopPropagation();
        setDeletingId(sessionId);
    };
    const confirmDelete = (e, sessionId) => {
        e.stopPropagation();
        onDeleteSession(sessionId);
        setDeletingId(null);
    };
    const cancelDelete = (e) => {
        e.stopPropagation();
        setDeletingId(null);
    };
    return (<div id="landing-page" className={`landing-page${isHiding ? ' hiding' : ''}`}>
      <div className="landing-inner">
        {/* Hero Input */}
        <div className="landing-hero">
          <h1 className="landing-hero-title">What would you like to build?</h1>
          <div className="landing-hero-input-wrap">
            <span className="hero-input-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a4.5 4.5 0 00-1.5 8.74V12a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-1.26A4.502 4.502 0 0010 2zm-1 13a.5.5 0 00.5.5h1a.5.5 0 00.5-.5v-.5H9v.5zm-.5 1.5a.5.5 0 000 1h3a.5.5 0 000-1h-3z"/>
              </svg>
            </span>
            {inspireLoading && <div className="hero-input-progress"/>}
            {!inputValue && !inspireLoading && (<span className={`hero-input-placeholder${placeholderVisible ? ' visible' : ''}`}>
                {INSPIRATIONS[placeholderIdx]}
              </span>)}
            {!inputValue && inspireLoading && (<span className="hero-input-placeholder visible" style={{ opacity: 0.5 }}>
                Generating idea...
              </span>)}
            <textarea ref={inputRef} rows={1} aria-label="Describe your app" autoComplete="off" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}/>
            <button className={`hero-inspire-btn${inspireLoading ? ' loading' : ''}`} aria-label="Inspire me" title="Inspire me" onClick={handleInspire} disabled={inspireLoading}>
              <Sparkle24Regular />
            </button>
            <button className="hero-send-btn" aria-label="Send" title="Send" onClick={() => handleSubmit(inputValue)}>
              <img src="assets/icons/commands/go.svg" width="16" height="16" alt=""/>
            </button>
          </div>
        </div>

        {/* Track Cards */}
        <div className="landing-tracks">
          {TRACKS.map(track => (<div className="track-card" key={track.id} onClick={() => handleSubmit(track.prompt)}>
              <span className="track-card-icon">{track.icon}</span>
              <div className="track-card-title">{track.title}</div>
              <p className="track-card-desc">{track.desc}</p>
              <button className="track-card-link" data-track={track.id} onClick={e => { e.stopPropagation(); handleSubmit(track.prompt); }}>
                Get started →
              </button>
            </div>))}
        </div>

        {/* Framework Pills */}
        <div className="framework-section">
          <span className="framework-separator-label">or start with a framework</span>
          <div className="framework-pills">
            {FRAMEWORKS.map(fw => (<button key={fw.id} className="framework-pill" data-framework={fw.label} onClick={() => handleSubmit(`I want to build with ${fw.label}`)}>
                {fw.label}
              </button>))}
          </div>
        </div>

        {/* IDE Launch Links */}
        <div className="landing-ide">
          <span className="landing-ide-label">Or use your IDE</span>
          <div className="ide-cards">
            <a className="ide-card" href={`vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'kickstart', command: 'npx', args: ['-y', '@kickstart/mcp-server'] }))}`} target="_blank" rel="noopener" title="Install Kickstart MCP server in VS Code">
              <span className="ide-card-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <mask id="vsc-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                    <path fillRule="evenodd" clipRule="evenodd" d="M70.912 99.317a6.223 6.223 0 004.932-.642l20.163-10.27A6.25 6.25 0 0099.23 83.2V16.805a6.25 6.25 0 00-3.222-5.206L75.844 1.326a6.227 6.227 0 00-7.128.735L29.211 36.6 12.105 23.77a4.163 4.163 0 00-5.32.262L1.57 29.029a4.168 4.168 0 00-.004 6.203L16.26 50 1.566 64.768a4.166 4.166 0 00.004 6.203l5.214 4.998a4.163 4.163 0 005.32.261l17.106-12.83 39.505 34.54a6.214 6.214 0 002.197 1.377zM75.015 27.27L45.11 50l29.906 22.73V27.27z" fill="#fff"/>
                  </mask>
                  <g mask="url(#vsc-mask)">
                    <path d="M96.01 10.28L75.845 1.325a6.226 6.226 0 00-7.127.736L1.566 64.768a4.167 4.167 0 00.004 6.203l5.214 4.997a4.162 4.162 0 005.32.262L96.425 16.86a6.25 6.25 0 00-2.807-5.26l2.39-1.32z" fill="#0065A9"/>
                    <path d="M96.01 89.721L75.845 98.674a6.226 6.226 0 01-7.127-.735L1.566 35.232a4.167 4.167 0 01.004-6.203l5.214-4.997a4.162 4.162 0 015.32-.262L96.425 83.14a6.25 6.25 0 01-2.807 5.26l2.39 1.32z" fill="#007ACC"/>
                    <path d="M75.845 98.675a6.226 6.226 0 01-7.127-.736c2.136 2.136 5.768.624 5.768-2.396V4.457c0-3.02-3.632-4.532-5.768-2.397a6.226 6.226 0 017.127-.735l20.165 10.274a6.25 6.25 0 013.222 5.206v66.39a6.25 6.25 0 01-3.222 5.206L75.845 98.675z" fill="#1F9CF0"/>
                  </g>
                </svg>
              </span>
              <span className="ide-card-name">VS Code</span>
            </a>
            <a className="ide-card" href={`vscode-insiders:mcp/install?${encodeURIComponent(JSON.stringify({ name: 'kickstart', command: 'npx', args: ['-y', '@kickstart/mcp-server'] }))}`} target="_blank" rel="noopener" title="Install Kickstart MCP server in VS Code Insiders">
              <span className="ide-card-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <mask id="vsci-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                    <path fillRule="evenodd" clipRule="evenodd" d="M70.912 99.317a6.223 6.223 0 004.932-.642l20.163-10.27A6.25 6.25 0 0099.23 83.2V16.805a6.25 6.25 0 00-3.222-5.206L75.844 1.326a6.227 6.227 0 00-7.128.735L29.211 36.6 12.105 23.77a4.163 4.163 0 00-5.32.262L1.57 29.029a4.168 4.168 0 00-.004 6.203L16.26 50 1.566 64.768a4.166 4.166 0 00.004 6.203l5.214 4.998a4.163 4.163 0 005.32.261l17.106-12.83 39.505 34.54a6.214 6.214 0 002.197 1.377zM75.015 27.27L45.11 50l29.906 22.73V27.27z" fill="#fff"/>
                  </mask>
                  <g mask="url(#vsci-mask)">
                    <path d="M96.01 10.28L75.845 1.325a6.226 6.226 0 00-7.127.736L1.566 64.768a4.167 4.167 0 00.004 6.203l5.214 4.997a4.162 4.162 0 005.32.262L96.425 16.86a6.25 6.25 0 00-2.807-5.26l2.39-1.32z" fill="#1A8A35"/>
                    <path d="M96.01 89.721L75.845 98.674a6.226 6.226 0 01-7.127-.735L1.566 35.232a4.167 4.167 0 01.004-6.203l5.214-4.997a4.162 4.162 0 015.32-.262L96.425 83.14a6.25 6.25 0 01-2.807 5.26l2.39 1.32z" fill="#24931E"/>
                    <path d="M75.845 98.675a6.226 6.226 0 01-7.127-.736c2.136 2.136 5.768.624 5.768-2.396V4.457c0-3.02-3.632-4.532-5.768-2.397a6.226 6.226 0 017.127-.735l20.165 10.274a6.25 6.25 0 013.222 5.206v66.39a6.25 6.25 0 01-3.222 5.206L75.845 98.675z" fill="#2FC44E"/>
                  </g>
                </svg>
              </span>
              <span className="ide-card-name">VS Code Insiders</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="landing-footer-powered">
            <span>Powered by</span>
            <img src="assets/icons/compute/aks-automatic.svg" alt="" width="16" height="16"/>
            <span>Azure Kubernetes Service (AKS) Automatic</span>
          </div>
          <div className="landing-footer-disclaimer">
            Kickstart uses AI. Check for mistakes.
          </div>
          <div className="landing-footer-meta">
            <span className="landing-footer-version">
              Kickstart Preview v{window.__BUILD_VERSION__ || '0.1.0'}
              {window.__BUILD_SHA__ && window.__BUILD_SHA__ !== 'dev'
            ? ` · ${window.__BUILD_SHA__}`
            : ' · dev'}
            </span>
            <a className="landing-footer-link" href="?playground">Playground</a>
          </div>
        </footer>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (<div className="recent-sessions-section">
            <div className="recent-sessions-header">
              <span className="recent-sessions-label">Recent</span>
              <button className="recent-sessions-clear" onClick={onClearAllSessions}>Clear all</button>
            </div>
            <div className="recent-sessions-list">
              {recentSessions.map(session => (<div key={session.id} className="recent-session-item" onClick={() => {
                    if (deletingId !== session.id)
                        onResumeSession(session.id);
                }}>
                  {deletingId === session.id ? (<div className="confirm-delete-bar">
                      <span className="confirm-delete-label">Delete this session?</span>
                      <button className="confirm-delete-yes" onClick={e => confirmDelete(e, session.id)}>Delete</button>
                      <button className="confirm-delete-no" onClick={cancelDelete}>Cancel</button>
                    </div>) : (<div className="recent-session-content">
                      <span className="recent-session-title">{session.title}</span>
                      <span className="recent-session-date">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                      <button className="recent-session-delete" onClick={e => handleDeleteClick(e, session.id)} aria-label="Delete session">
                        ×
                      </button>
                    </div>)}
                </div>))}
            </div>
          </div>)}
      </div>
    </div>);
}
//# sourceMappingURL=Landing.js.map