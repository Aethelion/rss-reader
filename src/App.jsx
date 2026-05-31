import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Rss, Settings, Menu, Search, ChevronRight, PanelLeftClose, PanelLeftOpen, 
  ExternalLink, Zap, Plus, RefreshCw, Bookmark, Circle, CheckCircle2, 
  Loader2, Trash2, X, Sparkles, Home, Layers, Folder, Pencil, List, 
  LayoutGrid, Share, Check, Network 
} from 'lucide-react';

// ============================================================================
// 1. CONSTANTS & UTILITIES
// ============================================================================

// These are the feeds that load the very first time the app is opened.
const DEFAULT_FEEDS = [
  { id: 'https://ourworldindata.org/atom.xml', name: 'Our World in Data', group: 'Analytics', url: 'https://ourworldindata.org/atom.xml' },
  { id: 'https://aeon.co/feed.rss', name: 'Aeon', group: 'News', url: 'https://aeon.co/feed.rss' },
  { id: 'https://torrentfreak.com/feed/', name: 'TorrentFreak', group: 'News', url: 'https://torrentfreak.com/feed/' }
];

// Tailwind classes for the article reading pane to make it look like a nice blog post
const PROSE_STYLES = `
  text-neutral-300 leading-relaxed text-[15px] break-words
  [&>h1]:text-white [&>h1]:text-2xl [&>h1]:font-semibold [&>h1]:mt-12 [&>h1]:mb-6
  [&>h2]:text-white [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-10 [&>h2]:mb-4
  [&>h3]:text-white [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mt-8 [&>h3]:mb-3
  [&>p]:mb-6 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-6 [&>ul>li]:mb-2 [&>ul>li::marker]:text-neutral-600
  [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-6 [&>ol>li]:mb-2
  [&>a]:text-white [&>a]:underline [&>a]:underline-offset-4 [&>a]:decoration-neutral-700 hover:[&>a]:decoration-white [&>a]:break-all
  [&>img]:rounded-lg [&>img]:border [&>img]:border-neutral-800 [&>img]:my-8 [&>img]:max-w-full [&>img]:h-auto
  [&>iframe]:w-full [&>iframe]:rounded-lg [&>iframe]:my-8 [&>iframe]:aspect-video
  [&>pre]:bg-[#050505] [&>pre]:border [&>pre]:border-neutral-800 [&>pre]:rounded-lg [&>pre]:p-4 [&>pre]:overflow-x-auto [&>pre]:mb-6
  [&>pre>code]:bg-transparent [&>pre>code]:border-0 [&>pre>code]:p-0
  [&>code]:text-neutral-200 [&>code]:bg-neutral-900 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-[13px] [&>code]:font-mono [&>code]:border [&>code]:border-neutral-800
  [&>blockquote]:border-l-2 [&>blockquote]:border-neutral-700 [&>blockquote]:pl-5 [&>blockquote]:italic [&>blockquote]:text-neutral-400 [&>blockquote]:my-8
`;

/**
 * Custom Hook: useLocalStorage
 * Works just like useState, but saves the data to the browser's local storage.
 * This ensures our feeds and saved articles aren't lost when we refresh the page.
 */
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn('LocalStorage error:', error);
    }
  };
  
  return [storedValue, setValue];
};

// Helper function to format dates nicely (e.g., "May 27, 2026")
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper function to calculate how long ago an article was posted (e.g., "4h", "2d")
const getRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffInSeconds = (new Date() - date) / 1000;
  
  if (isNaN(diffInSeconds)) return '';
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return formatDate(dateString);
};

// Helper function to remove HTML tags from text, used for previews and AI summaries
const stripHtml = (html) => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

// Helper function to find the first image in an article's HTML content
const extractImage = (text) => {
  if (!text) return null;
  
  let doc = new DOMParser().parseFromString(text, 'text/html');
  let img = doc.querySelector('img');
  if (img && img.src) return img.src;
  
  const unescapedText = doc.body.textContent;
  if (unescapedText && unescapedText.includes('<img')) {
    doc = new DOMParser().parseFromString(unescapedText, 'text/html');
    img = doc.querySelector('img');
    if (img && img.src) return img.src;
  }
  
  const regexMatch = text.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|gif|png|webp)/i);
  return regexMatch ? regexMatch[0] : null;
};

// ============================================================================
// 3. SHARED UI COMPONENTS
// ============================================================================

// Reusable text input component to keep our forms clean
const Input = ({ label, ...props }) => {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-neutral-400 mb-1">{label}</label>}
      <input 
        className="w-full bg-black border border-neutral-800 rounded-md py-2 px-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors" 
        {...props} 
      />
    </div>
  );
};

// Reusable popup modal component
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-[#0A0A0A] border border-neutral-800 rounded-lg shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-white tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Small notification popup at the bottom of the screen
const Toast = ({ message }) => {
  if (!message) return null;
  
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white text-black px-4 py-2 rounded-full text-xs font-medium shadow-2xl flex items-center gap-2">
        <Check size={14} />
        {message}
      </div>
    </div>
  );
};

// ============================================================================
// 4. FEATURE COMPONENTS
// ============================================================================

function AddFeedModal({ isOpen, onClose, onAdd, existingGroups, rsshubInstance }) {
  const [mode, setMode] = useState('direct');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  
  const [hubPlatform, setHubPlatform] = useState('twitter/user');
  const [hubParam1, setHubParam1] = useState('');
  const [hubParam2, setHubParam2] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGroup(existingGroups?.[0] || 'Custom');
      setUrl(''); 
      setName(''); 
      setHubParam1(''); 
      setHubParam2('');
    }
  }, [isOpen, existingGroups]);

  useEffect(() => {
    if (mode === 'rsshub') {
      const baseUrl = rsshubInstance.replace(/\/$/, '');
      let routePath = '';
      
      if (hubPlatform === 'twitter/user' && hubParam1) {
        routePath = `/twitter/user/${hubParam1}`;
      } else if (hubPlatform === 'youtube/channel' && hubParam1) {
        routePath = `/youtube/channel/${hubParam1}`;
      } else if (hubPlatform.startsWith('github') && hubParam1 && hubParam2) {
        routePath = `/${hubPlatform}/${hubParam1}/${hubParam2}`;
      } else if (hubPlatform === 'custom') {
        routePath = hubParam1.startsWith('/') ? hubParam1 : `/${hubParam1}`;
      }
      
      if (routePath && routePath !== '/') {
        setUrl(`${baseUrl}${routePath}`);
      } else {
        setUrl('');
      }
    }
  }, [mode, hubPlatform, hubParam1, hubParam2, rsshubInstance]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url) { 
      onAdd({ 
        url: url, 
        name: name || url, 
        group: group || 'Custom' 
      }); 
      onClose(); 
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Feed">
      <div className="flex bg-[#050505] p-1 rounded-md border border-neutral-800 mb-6">
        <button 
          onClick={() => setMode('direct')} 
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${mode === 'direct' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Direct URL
        </button>
        <button 
          onClick={() => setMode('rsshub')} 
          className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-colors ${mode === 'rsshub' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          <Network size={12} /> RSSHub Builder
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'direct' ? (
          <Input label="RSS URL" required autoFocus type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/feed.xml" />
        ) : (
          <div className="space-y-4 bg-neutral-900/30 p-3 rounded-md border border-neutral-800/50">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Platform Route</label>
              <select 
                value={hubPlatform} 
                onChange={(e) => { setHubPlatform(e.target.value); setHubParam1(''); setHubParam2(''); }} 
                className="w-full bg-black border border-neutral-800 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:border-neutral-500 appearance-none"
              >
                <option value="twitter/user">X (Twitter) User</option>
                <option value="youtube/channel">YouTube Channel</option>
                <option value="github/issue">GitHub Issues</option>
                <option value="github/release">GitHub Releases</option>
                <option value="custom">Custom RSSHub Route</option>
              </select>
            </div>
            
            {hubPlatform.startsWith('github') ? (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input label="OWNER" value={hubParam1} onChange={(e) => setHubParam1(e.target.value)} placeholder="e.g. vercel" />
                </div>
                <div className="flex-1">
                  <Input label="REPO" value={hubParam2} onChange={(e) => setHubParam2(e.target.value)} placeholder="e.g. next.js" />
                </div>
              </div>
            ) : (
              <Input label={hubPlatform === 'custom' ? 'ROUTE PATH' : 'ID / USERNAME'} value={hubParam1} onChange={(e) => setHubParam1(e.target.value)} placeholder={hubPlatform === 'custom' ? "/bilibili/user/dynamic/2267573" : "e.g. elonmusk"} />
            )}
            
            <Input label="GENERATED URL" readOnly type="url" value={url} placeholder="Generated URL will appear here" className="w-full bg-black border border-neutral-800 rounded-md py-1.5 px-3 text-xs text-neutral-400 outline-none" />
          </div>
        )}
        
        <div className="w-full h-px bg-neutral-900 my-2"></div>
        
        <Input label="Feed Name (Optional)" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Awesome Feed" />
        
        <Input label="Folder" required type="text" list="folder-options" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Engineering" />
        <datalist id="folder-options">
          {existingGroups?.map(groupName => <option key={groupName} value={groupName} />)}
        </datalist>
        
        <div className="pt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors">Cancel</button>
          <button type="submit" disabled={!url} className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-200 transition-colors disabled:opacity-50">Add Feed</button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsModal({ isOpen, onClose, apiKey, setApiKey, rsshubInstance, setRsshubInstance }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-200 mb-1 flex items-center gap-2">
            <Sparkles size={14} className="text-[#a855f7]" /> AI Summarization
          </label>
          <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">Enter your Google AI Studio Gemini API key to activate summarization.</p>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key here" />
        </div>
        
        <div className="w-full h-px bg-neutral-900 my-2"></div>
        
        <div>
          <label className="block text-sm font-medium text-neutral-200 mb-1 flex items-center gap-2">
            <Network size={14} className="text-blue-400" /> RSSHub Instance
          </label>
          <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">Configure the base URL used by the RSSHub generator.</p>
          <Input type="url" value={rsshubInstance} onChange={(e) => setRsshubInstance(e.target.value)} placeholder="https://rsshub.app" />
        </div>
        
        <div className="pt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-200 transition-colors">Done</button>
        </div>
      </div>
    </Modal>
  );
}

function Sidebar({ feeds, activeFilter, setActiveFilter, isSidebarOpen, setSidebarOpen, onAddFeedClick, onRefresh, isRefreshing, removeFeed, onOpenSettings, allCount, unreadCount, savedCount, feedUnreadCounts, onRenameFolder, onReorderFeeds }) {
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [editingFolder, setEditingFolder] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [dragTarget, setDragTarget] = useState(null);

  const groupedFeeds = useMemo(() => {
    const groups = {};
    for (const feed of feeds) {
      if (!groups[feed.group]) {
        groups[feed.group] = [];
      }
      groups[feed.group].push(feed);
    }
    return groups;
  }, [feeds]);

  const toggleFolder = (groupName) => { 
    if (editingFolder !== groupName) {
      setCollapsedFolders((prevState) => ({ 
        ...prevState, 
        [groupName]: !prevState[groupName] 
      })); 
    }
  };

  const submitRename = (groupName) => { 
    if (editValue.trim() && editValue !== groupName) {
      onRenameFolder(groupName, editValue.trim()); 
    }
    setEditingFolder(null); 
  };

  const FilterBtn = ({ id, icon: Icon, label, count }) => (
    <button 
      title={!isSidebarOpen ? label : undefined} 
      onClick={() => setActiveFilter(id)} 
      className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-md text-sm transition-colors group ${activeFilter === id ? 'bg-neutral-900 text-white font-medium' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'}`}
    >
      <div className="relative flex items-center justify-center">
        <Icon size={isSidebarOpen ? 16 : 22} strokeWidth={isSidebarOpen ? 2 : 1.5} className={activeFilter === id ? "text-white" : "text-neutral-500 group-hover:text-white transition-colors"} />
        {!isSidebarOpen && count > 0 && (
          <span className="absolute -top-2 -right-3 bg-neutral-600/90 border border-[#050505] text-neutral-100 text-[10px] font-medium rounded-full px-1 min-w-[20px] h-[18px] flex items-center justify-center z-10">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>
      {isSidebarOpen && (
        <>
          <span className="truncate flex-1 text-left">{label}</span>
          {count > 0 && <span className="text-[10px] text-neutral-400 bg-neutral-900/80 px-1.5 py-0.5 rounded-md border border-neutral-800">{count}</span>}
        </>
      )}
    </button>
  );

  return (
    <aside className={`flex flex-col bg-[#050505] border-r border-neutral-900 transition-all duration-300 ease-in-out h-full overflow-hidden shrink-0 ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 md:w-[72px] md:opacity-100'}`}>
      
      <div className={`h-14 flex items-center border-b border-neutral-900 shrink-0 ${isSidebarOpen ? 'px-4 justify-between' : 'justify-center'}`}>
        {isSidebarOpen && (
          <div className="flex items-center gap-2 text-white font-medium tracking-tight">
            <Zap size={16} className="text-white" /><span>Reader</span>
          </div>
        )}
        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-neutral-500 hover:text-white transition-colors">
          {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={20} strokeWidth={1.5} className="hidden md:block" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        
        <div className={`mb-6 space-y-1 ${isSidebarOpen ? 'px-3' : 'px-2 flex flex-col items-center gap-2'}`}>
          <FilterBtn id="ALL" icon={Home} label="All Articles" count={allCount} />
          <FilterBtn id="UNREAD" icon={Layers} label="Unread" count={unreadCount} />
          <FilterBtn id="SAVED" icon={Bookmark} label="Saved" count={savedCount} />
        </div>

        {Object.entries(groupedFeeds).map(([group, groupFeeds]) => {
          const isCollapsed = collapsedFolders[group];
          const isEditing = editingFolder === group;
          
          return (
            <div 
              key={group} 
              className={`mb-6 ${isSidebarOpen ? '' : 'flex flex-col items-center gap-1'}`} 
              onDragOver={(e) => { e.preventDefault(); setDragTarget(group); }} 
              onDragLeave={() => setDragTarget(null)} 
              onDrop={(e) => { 
                e.preventDefault(); 
                setDragTarget(null); 
                const draggedFeedId = e.dataTransfer.getData('text/plain'); 
                if (draggedFeedId) onReorderFeeds(draggedFeedId, null, group); 
              }}
            >
              <div title={!isSidebarOpen ? group : undefined} className={`flex items-center transition-colors group/folder w-full relative ${isSidebarOpen ? 'justify-between px-6 py-1 mb-1 text-xs font-semibold text-neutral-500 uppercase tracking-wider' : 'justify-center p-1.5 mb-1 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900'} ${dragTarget === group && !isSidebarOpen ? 'bg-neutral-900 ring-1 ring-neutral-700' : ''}`}>
                {isSidebarOpen ? (
                  isEditing ? (
                    <input 
                      autoFocus 
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)} 
                      onBlur={() => submitRename(group)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') submitRename(group); if (e.key === 'Escape') setEditingFolder(null); }} 
                      className="bg-black border border-neutral-700 rounded px-2 py-0.5 text-xs text-white outline-none w-full mr-2" 
                      onClick={(e) => e.stopPropagation()} 
                    />
                  ) : (
                    <>
                      <button onClick={() => toggleFolder(group)} className="flex-1 text-left hover:text-neutral-300 flex items-center h-full">
                        <span className="truncate">{group}</span>
                      </button>
                      <div className="flex items-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingFolder(group); setEditValue(group); }} 
                          className="opacity-0 pointer-events-none group-hover/folder:pointer-events-auto group-hover/folder:opacity-100 p-1 hover:text-white mr-1 transition-opacity"
                        >
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => toggleFolder(group)} className="p-1 hover:text-white transition-colors">
                          <ChevronRight size={14} className={`transition-transform duration-200 ${!isCollapsed ? 'rotate-90 text-neutral-400' : 'text-neutral-600'}`} />
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <button onClick={() => toggleFolder(group)}>
                    <Folder size={18} strokeWidth={1.5} className={isCollapsed ? 'text-neutral-400' : 'text-neutral-600'} />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className={`space-y-1 w-full ${isSidebarOpen ? 'px-3' : 'px-2 flex flex-col items-center gap-1'}`}>
                  {groupFeeds.map(feed => (
                    <div 
                      key={feed.id} 
                      draggable 
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', feed.id)} 
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(feed.id); }} 
                      onDragLeave={() => setDragTarget(null)} 
                      onDrop={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        setDragTarget(null); 
                        const draggedFeedId = e.dataTransfer.getData('text/plain'); 
                        if (draggedFeedId) onReorderFeeds(draggedFeedId, feed.id, group); 
                      }} 
                      className={`group/feed flex items-center justify-center relative w-full rounded-md transition-all ${dragTarget === feed.id ? 'ring-1 ring-white/30 bg-neutral-900/50' : ''}`}
                    >
                      <button 
                        title={!isSidebarOpen ? feed.name : undefined} 
                        onClick={() => setActiveFilter(feed.id)} 
                        className={`flex-1 flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-md text-sm transition-colors text-left truncate relative ${activeFilter === feed.id ? 'bg-neutral-900 text-white font-medium' : 'text-neutral-400 hover:text-white hover:bg-neutral-900/50'}`}
                      >
                        {isSidebarOpen ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 shrink-0"></span>
                            <span className="truncate flex-1">{feed.name}</span>
                            {feedUnreadCounts[feed.id] > 0 && (
                              <span className="transition-opacity group-hover/feed:opacity-0 pointer-events-none text-[10px] text-neutral-400 bg-neutral-900/80 px-1.5 py-0.5 rounded-md border border-neutral-800">
                                {feedUnreadCounts[feed.id]}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="relative flex items-center justify-center">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold uppercase transition-colors ${activeFilter === feed.id ? 'bg-neutral-700 text-white' : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800/50 group-hover/feed:text-white group-hover/feed:bg-neutral-800'}`}>
                              {feed.name.charAt(0)}
                            </div>
                            {feedUnreadCounts[feed.id] > 0 && (
                              <span className="absolute -top-2 -right-2 bg-neutral-600/90 border border-[#050505] text-neutral-100 text-[10px] font-medium rounded-full px-1 min-w-[20px] h-[18px] flex items-center justify-center z-10 pointer-events-none">
                                {feedUnreadCounts[feed.id] > 99 ? '99+' : feedUnreadCounts[feed.id]}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                      {isSidebarOpen && (
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFeed(feed.id); }} 
                          className="opacity-0 pointer-events-none group-hover/feed:opacity-100 group-hover/feed:pointer-events-auto flex p-1.5 text-neutral-500 hover:text-red-400 transition-all rounded-md bg-transparent hover:bg-neutral-800 absolute right-1 z-10"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-neutral-900 flex flex-col gap-1">
        {[
          { icon: Plus, label: "Add Feed", onClick: onAddFeedClick },
          { icon: RefreshCw, label: isRefreshing ? 'Refreshing...' : 'Refresh Feeds', onClick: onRefresh, spin: isRefreshing },
          { icon: Settings, label: "Settings", onClick: onOpenSettings }
        ].map((btn, index) => (
          <button 
            key={index} 
            title={!isSidebarOpen ? btn.label : undefined} 
            onClick={btn.onClick} 
            disabled={btn.spin} 
            className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-900/50 rounded-md transition-colors w-full disabled:opacity-50`}
          >
            <btn.icon size={isSidebarOpen ? 16 : 22} strokeWidth={isSidebarOpen ? 2 : 1.5} className={btn.spin ? "animate-spin" : ""} />
            {isSidebarOpen && <span>{btn.label}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}

function ArticleList({ articles, activeArticle, setActiveArticle, isSidebarOpen, setSidebarOpen, readStates, savedStates, toggleSaved, toggleRead, feeds, viewMode, setViewMode, showToast }) {
  const [searchQuery, setSearchQuery] = useState('');

  const searchedArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return articles;
    
    return articles.filter((article) => {
      const titleMatches = article.title?.toLowerCase().includes(query);
      const summaryMatches = article.summary?.toLowerCase().includes(query);
      return titleMatches || summaryMatches;
    });
  }, [articles, searchQuery]);

  const handleShare = async (e, url, title) => {
    e.stopPropagation();
    if (navigator.share) { 
      try { 
        await navigator.share({ title, url }); 
      } catch (error) {
        // Safe bypass on cancellation
      } 
    } else { 
      navigator.clipboard.writeText(url); 
      showToast('Link copied to clipboard'); 
    }
  };

  return (
    <section className="w-full flex flex-col bg-[#0A0A0A] border-r border-neutral-900 shrink-0 h-full">
      
      <div className="h-14 flex items-center px-4 border-b border-neutral-900 gap-3 shrink-0">
        {!isSidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-neutral-500 hover:text-white transition-colors">
            <Menu size={18} />
          </button>
        )}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search articles..." 
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-md py-1.5 pl-9 pr-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600" 
          />
        </div>
        <div className="flex bg-black/50 border border-neutral-800 rounded p-0.5 shrink-0 ml-1">
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <List size={14} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto custom-scrollbar ${viewMode === 'grid' ? 'p-4 md:p-6 bg-[#050505]' : ''}`}>
        {searchedArticles.length === 0 && <div className="p-8 text-center text-neutral-500 text-sm">No articles found.</div>}

        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5" : "flex flex-col"}>
          {searchedArticles.map(article => {
            const isRead = readStates[article.id];
            const isSaved = savedStates[article.id];
            
            const parentFeed = feeds.find((f) => f.id === article.feedId);
            const feedName = parentFeed ? parentFeed.name : 'Unknown Feed';
            
            if (viewMode === 'grid') {
              return (
                <div key={article.id} onClick={() => setActiveArticle(article.id)} className={`group flex flex-col bg-[#0f0f0f] border border-neutral-800 rounded-xl overflow-hidden cursor-pointer transition-all hover:border-neutral-700 hover:bg-[#141414] ${isRead ? 'opacity-60' : 'opacity-100'}`}>
                  {article.thumbnail ? (
                    <img src={article.thumbnail} alt={article.title} className="w-full h-40 md:h-44 object-cover border-b border-neutral-800/50" />
                  ) : (
                    <div className="w-full h-40 md:h-44 bg-gradient-to-br from-neutral-800 to-[#111] border-b border-neutral-800/50 flex items-center justify-center">
                      <span className="text-4xl text-neutral-700 font-bold opacity-30">{feedName.charAt(0)}</span>
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="text-sm font-semibold text-neutral-200 line-clamp-3 mb-2 leading-snug">{article.title}</h4>
                    <div className="text-xs text-neutral-500 mb-4">{feedName}</div>
                    <div className="mt-auto flex items-center justify-between text-xs text-neutral-500">
                      <span>{getRelativeTime(article.date)}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); toggleSaved(article.id); }} className={`transition-colors ${isSaved ? 'text-white' : 'text-neutral-600 hover:text-neutral-300'}`}>
                          <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleRead(article.id); }} className={`transition-colors ${isRead ? 'text-white' : 'text-neutral-600 hover:text-neutral-300'}`}>
                          {isRead ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                        <button onClick={(e) => handleShare(e, article.url, article.title)} className="text-neutral-600 hover:text-neutral-300 transition-colors">
                          <Share size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); window.open(article.url, '_blank'); }} className="text-neutral-600 hover:text-neutral-300 transition-colors">
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={article.id} onClick={() => setActiveArticle(article.id)} className={`group w-full text-left p-4 border-b border-neutral-900/50 transition-all cursor-pointer relative ${activeArticle === article.id ? 'bg-neutral-900/80' : 'hover:bg-neutral-900/40'} ${isRead ? 'opacity-60' : 'opacity-100'}`}>
                {!isRead && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white rounded-r-full" />}
                <div className="flex justify-between items-start mb-1.5 gap-2">
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider truncate">{feedName}</span>
                  <span className="text-[11px] text-neutral-600 whitespace-nowrap flex items-center gap-1 shrink-0">{getRelativeTime(article.date)}</span>
                </div>
                <h4 className={`text-sm mb-2 leading-snug tracking-tight ${activeArticle === article.id ? 'text-white font-semibold' : 'text-neutral-200 font-medium'}`}>{article.title}</h4>
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{stripHtml(article.summary || article.content)}</p>
                
                <div className={`absolute bottom-4 right-4 flex gap-2 ${(activeArticle === article.id || isSaved) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                  <button onClick={(e) => { e.stopPropagation(); toggleSaved(article.id); }} className={`p-1.5 rounded bg-[#0A0A0A] border border-neutral-800 transition-colors ${isSaved ? 'text-white' : 'text-neutral-500 hover:text-white'}`}>
                    <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReadingPane({ article, feed, isSaved, toggleSaved, toggleRead, isRead, onSummarize, isSummarizing, aiSummary, onBack, viewMode }) {
  const scrollRef = useRef(null);
  
  useEffect(() => { 
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [article?.id]);

  if (!article) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center text-neutral-700 h-full">
        <Rss size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-medium">Select an article to start reading</p>
      </div>
    );
  }

  return (
    <article ref={scrollRef} className="flex-1 bg-black overflow-y-auto h-full relative custom-scrollbar">
      <div className="sticky top-0 w-full h-14 bg-black/90 backdrop-blur-md border-b border-neutral-900 flex items-center justify-between px-4 md:px-6 z-10">
        <button onClick={onBack} className={`flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors mr-4 ${viewMode === 'grid' ? '' : 'md:hidden'}`}>
          <ChevronRight size={16} className="rotate-180" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleRead(article.id)} className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-md transition-colors">
            {isRead ? <Circle size={14} /> : <CheckCircle2 size={14} />}
            {isRead ? 'Mark Unread' : 'Mark Read'}
          </button>
          <button onClick={() => toggleSaved(article.id)} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${isSaved ? 'text-black bg-white hover:bg-neutral-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}>
            <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
            <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
          </button>
          <div className="w-px h-4 bg-neutral-800 mx-1"></div>
          <button onClick={() => onSummarize(article)} disabled={isSummarizing} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors border border-neutral-800 ${aiSummary ? 'text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]/30' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'}`}>
            {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span className="hidden sm:inline">{aiSummary ? 'AI Summarized' : 'AI Summary'}</span>
            <span className="sm:hidden">{aiSummary ? 'Done' : 'AI'}</span>
          </button>
          <div className="w-px h-4 bg-neutral-800 mx-1"></div>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-md transition-colors">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 md:py-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-widest mb-6">
            <span>{feed?.name || 'Unknown Feed'}</span>
            <ChevronRight size={12} className="opacity-50" />
            <span>{formatDate(article.date)}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tighter leading-[1.2] mb-6">{article.title}</h1>
          {article.author && <div className="text-sm text-neutral-400">By <span className="text-neutral-200">{article.author}</span></div>}
        </header>

        {aiSummary && (
          <div className="mb-12 p-5 sm:p-6 rounded-lg border border-neutral-800 bg-[#0A0A0A] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#a855f7] to-[#3b82f6]"></div>
            <div className="flex items-center gap-2 mb-4 text-[#a855f7]"><Sparkles size={16} /><h3 className="text-sm font-semibold uppercase tracking-wider">AI Summary & Context</h3></div>
            <div className="text-neutral-300 text-[14px] leading-relaxed [&>p]:mb-4 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>li]:mb-1.5 [&>strong]:text-white [&>strong]:font-semibold" dangerouslySetInnerHTML={{ __html: aiSummary }} />
          </div>
        )}

        <div className={PROSE_STYLES} dangerouslySetInnerHTML={{ __html: article.content }} />
      </div>
    </article>
  );
}

// ============================================================================
// 5. MAIN APPLICATION ORCHESTRATOR
// ============================================================================

export default function App() {
  const [feeds, setFeeds] = useLocalStorage('rss_feeds', DEFAULT_FEEDS);
  const [readStates, setReadStates] = useLocalStorage('rss_read_states', {}); 
  const [savedStates, setSavedStates] = useLocalStorage('rss_saved_states', {}); 
  const [userApiKey, setUserApiKey] = useLocalStorage('rss_api_key', '');
  const [rsshubInstance, setRsshubInstance] = useLocalStorage('rsshub_instance', 'https://rsshub.app');
  const [aiSummaries, setAiSummaries] = useLocalStorage('rss_ai_summaries', {});
  const [viewMode, setViewMode] = useLocalStorage('rss_view_mode', 'list');
  
  const [articles, setArticles] = useState([]);
  const [activeFilter, setActiveFilter] = useState('ALL'); 
  const [activeArticleId, setActiveArticleId] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddFeedModalOpen, setAddFeedModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isSummarizingStates, setIsSummarizingStates] = useState({});
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = useCallback((msg) => { 
    setToastMsg(msg); 
    setTimeout(() => setToastMsg(null), 3000); 
  }, []);

  const existingGroups = useMemo(() => {
    return Array.from(new Set(feeds.map((feed) => feed.group)));
  }, [feeds]);

  const handleSummarize = async (article) => {
    if (isSummarizingStates[article.id]) return;
    
    setIsSummarizingStates((prevState) => ({ ...prevState, [article.id]: true }));
    
    if (!userApiKey || userApiKey.trim() === '') {
      setAiSummaries((prevState) => ({ 
        ...prevState, 
        [article.id]: "<p class='text-amber-500 font-medium'>Please enter your Gemini API Key in the Settings (gear icon in the bottom left sidebar) to enable AI summarization.</p>" 
      }));
      setIsSummarizingStates((prevState) => ({ ...prevState, [article.id]: false }));
      return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey.trim()}`;
    const cleanExcerpt = stripHtml(article.content || article.summary).substring(0, 4500);

    const buildPayload = (includeGrounding) => {
      const payload = {
        contents: [{ 
          parts: [{ 
            text: `Summarize this RSS feed article. Use simple, clear paragraphs. Title: "${article.title}". Link: ${article.url}. Text: ${cleanExcerpt}` 
          }] 
        }],
        systemInstruction: { 
          parts: [{ 
            text: "You are an expert summary assistant. Return a TL;DR summary using semantic HTML markup strictly (only wrap paragraphs in <p>, keys in <strong>, bullet points in <ul> and <li>). Do not output markdown fences or code blocks like ```html." 
          }] 
        }
      };
      
      if (includeGrounding) {
        payload.tools = [{ google_search: {} }];
      }
      return payload;
    };

    const sendRequest = async (useGrounding) => {
      const response = await fetch(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(buildPayload(useGrounding)) 
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        const parsedMessage = errorJson.error?.message || `HTTP error ${response.status}`;
        throw new Error(parsedMessage);
      }
      return await response.json();
    };

    try {
      let data;
      try {
        data = await sendRequest(true);
      } catch (err) {
        console.warn("Retrying without Google Search Grounding tools due to permission restrictions:", err);
        data = await sendRequest(false);
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error("Empty response received from AI Studio model API.");
      }

      const htmlContent = rawText
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();

      setAiSummaries((prevState) => ({ ...prevState, [article.id]: htmlContent }));
    } catch (error) {
      console.error("Gemini Summarization Pipeline Crash:", error);
      setAiSummaries((prevState) => ({ 
        ...prevState, 
        [article.id]: `<p class='text-red-400 font-medium'>Error: ${error.message || 'Summarizer encountered a connection error.'}<br/><span class='text-xs text-neutral-500'>Please check if your API Key in the Settings page is valid.</span></p>` 
      }));
    } finally { 
      setIsSummarizingStates((prevState) => ({ ...prevState, [article.id]: false })); 
    }
  };

  const fetchFeeds = useCallback(async (feedList) => {
    setIsRefreshing(true);
    try {
      const fetchPromises = feedList.map(async (feed) => {
        try {
          const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`);
          const data = await response.json();
          
          if (data.status !== 'ok') return [];
          
          return data.items.map((item) => {
            return {
              id: item.guid || item.link, 
              feedId: feed.id, 
              title: item.title, 
              author: item.author || '',
              date: item.pubDate, 
              summary: item.description, 
              content: item.content || item.description, 
              url: item.link,
              thumbnail: 
                item.thumbnail || 
                (item.enclosure?.link?.match(/\.(jpeg|jpg|gif|png|webp)/i) ? item.enclosure.link : null) || 
                (item.enclosure?.type?.startsWith('image/') ? item.enclosure.link : null) || 
                extractImage(item.content) || 
                extractImage(item.description)
            };
          });
        } catch (error) { 
          return []; 
        } 
      });
      
      const results = await Promise.all(fetchPromises);
      const flattenedArticles = results.flat();
      flattenedArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setArticles(flattenedArticles);
    } finally { 
      setIsRefreshing(false); 
    }
  }, []);

  useEffect(() => {
    fetchFeeds(feeds);
    const interval = setInterval(() => {
      fetchFeeds(feeds);
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [feeds, fetchFeeds]);

  const handleSelectFilter = (id) => { 
    setActiveFilter(id); 
    setActiveArticleId(null); 
  };
  
  const handleAddFeed = (newFeedData) => { 
    const feed = { ...newFeedData, id: newFeedData.url }; 
    if (!feeds.some((f) => f.id === feed.id)) { 
      setFeeds([...feeds, feed]); 
      showToast('Feed added'); 
    } 
  };
  
  const handleRemoveFeed = (id) => { 
    setFeeds(feeds.filter((f) => f.id !== id)); 
    if (activeFilter === id) {
      setActiveFilter('ALL'); 
    }
    showToast('Feed removed'); 
  };
  
  const handleRenameFolder = useCallback((oldGroup, newGroup) => {
    setFeeds((prevFeeds) => prevFeeds.map((feed) => feed.group === oldGroup ? { ...feed, group: newGroup } : feed));
  }, [setFeeds]);
  
  const handleReorderFeeds = useCallback((draggedId, targetId, targetGroup) => {
    if (draggedId === targetId) return;
    
    setFeeds((prevFeeds) => {
      const newFeeds = [...prevFeeds];
      const draggedIdx = newFeeds.findIndex((f) => f.id === draggedId);
      
      if (draggedIdx === -1) return prevFeeds;
      
      const draggedFeed = { ...newFeeds.splice(draggedIdx, 1)[0], group: targetGroup };
      
      if (targetId) {
        const targetIdx = newFeeds.findIndex((f) => f.id === targetId);
        newFeeds.splice(targetIdx, 0, draggedFeed);
      } else {
        newFeeds.push(draggedFeed);
      }
      return newFeeds;
    });
  }, [setFeeds]);

  const toggleSaved = (id) => {
    setSavedStates((prevState) => { 
      const isNowSaved = !prevState[id]; 
      if (isNowSaved) showToast('Article saved'); 
      return { ...prevState, [id]: isNowSaved }; 
    });
  };
  
  const toggleRead = (id) => {
    setReadStates((prevState) => ({ ...prevState, [id]: !prevState[id] }));
  };
  
  const handleSelectArticle = (id) => { 
    setActiveArticleId(id); 
    if (!readStates[id]) {
      setReadStates((prevState) => ({ ...prevState, [id]: true }));
    }
  };

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (activeFilter === 'UNREAD') return !readStates[article.id];
      if (activeFilter === 'SAVED') return savedStates[article.id];
      if (activeFilter !== 'ALL') return article.feedId === activeFilter;
      return true;
    });
  }, [articles, activeFilter, readStates, savedStates]);
  
  const activeArticle = useMemo(() => articles.find((a) => a.id === activeArticleId) || null, [articles, activeArticleId]);
  const unreadCount = useMemo(() => articles.filter((a) => !readStates[a.id]).length, [articles, readStates]);
  const savedCount = useMemo(() => Object.values(savedStates).filter(Boolean).length, [savedStates]);
  
  const feedUnreadCounts = useMemo(() => {
    return articles.reduce((accumulator, article) => { 
      if (!readStates[article.id]) {
        accumulator[article.feedId] = (accumulator[article.feedId] || 0) + 1; 
      }
      return accumulator; 
    }, {});
  }, [articles, readStates]);

  return (
    <div className="flex h-screen w-full bg-black text-neutral-300 font-sans overflow-hidden antialiased selection:bg-white selection:text-black">
      
      <style dangerouslySetInnerHTML={{__html: ` 
        .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; } 
      `}} />
      
      <Toast message={toastMsg} />
      
      <AddFeedModal isOpen={isAddFeedModalOpen} onClose={() => setAddFeedModalOpen(false)} onAdd={handleAddFeed} existingGroups={existingGroups} rsshubInstance={rsshubInstance} />
      
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} apiKey={userApiKey} setApiKey={setUserApiKey} rsshubInstance={rsshubInstance} setRsshubInstance={setRsshubInstance} />
      
      <Sidebar feeds={feeds} activeFilter={activeFilter} setActiveFilter={handleSelectFilter} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} onAddFeedClick={() => setAddFeedModalOpen(true)} onRefresh={() => fetchFeeds(feeds)} isRefreshing={isRefreshing} removeFeed={handleRemoveFeed} onOpenSettings={() => setSettingsModalOpen(true)} allCount={articles.length} unreadCount={unreadCount} savedCount={savedCount} feedUnreadCounts={feedUnreadCounts} onRenameFolder={handleRenameFolder} onReorderFeeds={handleReorderFeeds} />

      <main className="flex flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 md:relative md:inset-auto h-full flex shrink-0 z-10 bg-black ${viewMode === 'grid' ? 'w-full flex-1' : 'w-full md:w-[340px] lg:w-[400px]'} ${activeArticleId && viewMode === 'grid' ? 'hidden' : ''} ${activeArticleId && viewMode === 'list' ? 'hidden md:flex' : 'flex'}`}>
          <ArticleList articles={filteredArticles} activeArticle={activeArticleId} setActiveArticle={handleSelectArticle} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} readStates={readStates} savedStates={savedStates} toggleSaved={toggleSaved} toggleRead={toggleRead} feeds={feeds} viewMode={viewMode} setViewMode={setViewMode} showToast={showToast} />
        </div>
        
        <div className={`absolute inset-0 md:relative md:inset-auto flex-1 z-20 md:z-auto h-full bg-black ${!activeArticleId ? 'hidden' : 'block'} ${activeArticleId && viewMode === 'grid' ? 'w-full' : ''}`}>
          <ReadingPane article={activeArticle} feed={feeds.find((f) => f.id === activeArticle?.feedId)} isSaved={activeArticle ? savedStates[activeArticle.id] : false} isRead={activeArticle ? readStates[activeArticle.id] : false} toggleSaved={toggleSaved} toggleRead={toggleRead} onSummarize={handleSummarize} isSummarizing={activeArticle ? isSummarizingStates[activeArticle.id] : false} aiSummary={activeArticle ? aiSummaries[activeArticle.id] : null} onBack={() => setActiveArticleId(null)} viewMode={viewMode} />
        </div>
      </main>
    </div>
  );
}