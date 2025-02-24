import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [isKeySet, setIsKeySet] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [apps, setApps] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newApp, setNewApp] = useState({
    title: '',
    description: '',
    blocks: []
  })
  const [showVariableHints, setShowVariableHints] = useState(false)
  const [activeApp, setActiveApp] = useState(null)
  const [blockOutputs, setBlockOutputs] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [pendingOutputs, setPendingOutputs] = useState([])

  const MODELS = [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/o3-mini', name: 'O3 Mini' },
    { id: 'openai/chatgpt-4o-latest', name: '4o Latest' },
    { id: 'openai/gpt-4o-mini', name: '4o Mini' },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' }
  ]

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const db = await openDB()
        const key = await getApiKey(db)
        if (key) {
          setApiKey(key)
          setIsKeySet(true)
          const loadedApps = await getApps(db)
          setApps(loadedApps || [])
        }
      } catch (error) {
        console.error('Error initializing app:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    initializeApp()
  }, [])

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AgencyDB', 2)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
        if (!db.objectStoreNames.contains('apps')) {
          const appsStore = db.createObjectStore('apps', { keyPath: 'id' })
          appsStore.createIndex('createdAt', 'createdAt')
        }
      }
    })
  }

  const getApiKey = async (db) => {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(['settings'], 'readonly')
        const store = transaction.objectStore('settings')
        const request = store.get('openRouterKey')

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      } catch (error) {
        reject(error)
      }
    })
  }

  const saveApiKey = async () => {
    try {
      const db = await openDB()
      const transaction = db.transaction(['settings'], 'readwrite')
      const store = transaction.objectStore('settings')
      await store.put(apiKey, 'openRouterKey')
      setIsKeySet(true)
      const loadedApps = await getApps(db)
      setApps(loadedApps || [])
    } catch (error) {
      console.error('Error saving API key:', error)
    }
  }

  const getApps = async (db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['apps'], 'readonly')
      const store = transaction.objectStore('apps')
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  const handleCreateApp = () => {
    setShowCreateModal(true)
  }

  const handleAddBlock = (type, inputType = 'user') => {
    setNewApp(prev => ({
      ...prev,
      blocks: [...prev.blocks, {
        id: Date.now(),
        type,
        inputType: type === 'input' ? inputType : undefined,
        content: '',
        prompt: type === 'output' ? '' : undefined,
        model: type === 'output' ? MODELS[0].id : undefined
      }]
    }))
  }

  const handleBlockChange = (id, updates) => {
    setNewApp(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === id ? { ...block, ...updates } : block
      )
    }))
  }

  const handleSaveApp = async () => {
    try {
      if (!newApp.title.trim()) {
        alert('Please enter an app title')
        return
      }

      const db = await openDB()
      const transaction = db.transaction(['apps'], 'readwrite')
      const store = transaction.objectStore('apps')
      
      // Add timestamp and clean up the app object
      const appToSave = {
        id: Date.now(),
        ...newApp,
        blocks: newApp.blocks.map(block => ({
          ...block,
          // Clean up any temporary UI state we don't want to save
          showVariableHints: undefined
        })),
        createdAt: new Date().toISOString()
      }
      
      await store.add(appToSave)
      
      // Refresh the apps list
      const apps = await getApps(db)
      setApps(apps)
      
      // Reset and close modal
      setNewApp({ title: '', description: '', blocks: [] })
      setShowCreateModal(false)
    } catch (error) {
      console.error('Error saving app:', error)
      alert('Failed to save app: ' + error.message)
    }
  }

  const processPrompt = (prompt, blocks) => {
    return prompt.replace(/@block(\d+)/g, (match, blockNum) => {
      const blockIndex = parseInt(blockNum) - 1
      if (blockIndex >= 0 && blockIndex < blocks.length) {
        return blocks[blockIndex].output || blocks[blockIndex].content || ''
      }
      return match
    })
  }

  const generateOutput = async (blockId, prompt) => {
    try {
      const processedPrompt = processPrompt(prompt, newApp.blocks)
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'Agency App Builder',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [{ role: 'user', content: processedPrompt }],
          temperature: 0.7,
        })
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'API Error')
      
      const output = data.choices[0].message.content
      handleBlockChange(blockId, { output })
    } catch (error) {
      console.error('Error generating output:', error)
      handleBlockChange(blockId, { output: `Error: ${error.message}` })
    }
  }

  const handleOpenApp = (app) => {
    setActiveApp(app)
    setBlockOutputs({})
  }

  const handleAppInput = async (blockId, value) => {
    // First update the current block's output
    const newOutputs = {
      ...blockOutputs,
      [blockId]: value
    }
    setBlockOutputs(newOutputs)

    // Find the current block's index
    const currentIndex = activeApp.blocks.findIndex(b => b.id === blockId)
    
    // Process subsequent output blocks
    for (let i = currentIndex + 1; i < activeApp.blocks.length; i++) {
      const nextBlock = activeApp.blocks[i]
      if (nextBlock.type === 'output') {
        setIsProcessing(true)
        try {
          // Use the updated outputs object instead of the state
          const processedPrompt = processPrompt(nextBlock.prompt, activeApp.blocks.map(block => ({
            ...block,
            output: newOutputs[block.id], // Use our local outputs object
            content: block.content || newOutputs[block.id] // Include content for input blocks
          })))

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.href,
              'X-Title': 'Agency App Builder',
            },
            body: JSON.stringify({
              model: nextBlock.model || 'openai/gpt-3.5-turbo',
              messages: [{ role: 'user', content: processedPrompt }],
              temperature: 0.7,
            })
          })
          
          const data = await response.json()
          if (!response.ok) throw new Error(data.error?.message || 'API Error')
          
          // Update our local outputs object with the new response
          newOutputs[nextBlock.id] = data.choices[0].message.content
          setBlockOutputs(newOutputs)
        } catch (error) {
          console.error('Error generating output:', error)
          newOutputs[nextBlock.id] = `Error: ${error.message}`
          setBlockOutputs(newOutputs)
        }
      }
    }
    setIsProcessing(false)
  }

  const handleRunApp = async () => {
    setIsProcessing(true)
    setPendingOutputs([])

    try {
      for (const block of activeApp.blocks) {
        if (block.type === 'output') {
          const processedPrompt = processPrompt(block.prompt, activeApp.blocks.map(b => ({
            ...b,
            output: blockOutputs[b.id]
          })))

          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.href,
              'X-Title': 'Agency App Builder',
            },
            body: JSON.stringify({
              model: block.model,
              messages: [{ role: 'user', content: processedPrompt }],
              temperature: 0.7,
            })
          })
          
          const data = await response.json()
          if (!response.ok) throw new Error(data.error?.message || 'API Error')
          
          setBlockOutputs(prev => ({
            ...prev,
            [block.id]: data.choices[0].message.content
          }))
        }
      }
    } catch (error) {
      console.error('Error running app:', error)
      alert('Error running app: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteApp = async (e, appId) => {
    e.stopPropagation() // Prevent opening the app when clicking delete
    
    if (!confirm('Are you sure you want to delete this app?')) return

    try {
      const db = await openDB()
      const transaction = db.transaction(['apps'], 'readwrite')
      const store = transaction.objectStore('apps')
      await store.delete(appId)
      
      // Refresh the apps list
      const apps = await getApps(db)
      setApps(apps)
    } catch (error) {
      console.error('Error deleting app:', error)
      alert('Failed to delete app: ' + error.message)
    }
  }

  if (isLoading) {
    return <div className="loading">Initializing...</div>
  }

  if (!isKeySet) {
    return (
      <div className="api-key-prompt">
        <h2>Enter your OpenRouter API Key</h2>
        <div className="input-wrapper">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-v1-..."
            spellCheck="false"
            autoComplete="off"
          />
        </div>
        <button 
          onClick={saveApiKey}
          disabled={!apiKey.trim()}
        >
          Continue to Agency
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Your Apps</h1>
        <button className="create-button" onClick={handleCreateApp}>
          <span className="plus-icon">+</span>
          Create App
        </button>
      </div>
      
      <div className="apps-grid">
        {apps.length === 0 ? (
          <div className="empty-state">
            <p>No apps yet. Create your first app to get started.</p>
          </div>
        ) : (
          apps.map(app => (
            <div key={app.id} className="app-card" onClick={() => handleOpenApp(app)}>
              <h3>{app.title}</h3>
              <p>{app.description}</p>
              <div className="app-card-footer">
                <button className="text-button delete-button" onClick={(e) => handleDeleteApp(e, app.id)}>
                  Delete
                </button>
                <button className="text-button">Open</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New App</h2>
              <button className="close-button" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <input
                type="text"
                placeholder="App Title"
                value={newApp.title}
                onChange={e => setNewApp(prev => ({ ...prev, title: e.target.value }))}
              />
              <input
                type="text"
                placeholder="App Description"
                value={newApp.description}
                onChange={e => setNewApp(prev => ({ ...prev, description: e.target.value }))}
              />

              <div className="blocks">
                {newApp.blocks.map(block => (
                  <div key={block.id} className={`block ${block.type}-block`}>
                    {block.type === 'input' ? (
                      <div className="input-block">
                        <div className="block-header">
                          <label>{block.inputType === 'static' ? 'Static Text' : 'User Input'}</label>
                        </div>
                        <textarea
                          placeholder={block.inputType === 'static' ? 
                            "Enter your static text..." : 
                            "This will be requested from the user..."
                          }
                          value={block.content}
                          onChange={e => handleBlockChange(block.id, { content: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="output-block-content">
                        <div className="block-header">
                          <label>AI Output</label>
                          <select
                            value={block.model}
                            onChange={e => handleBlockChange(block.id, { model: e.target.value })}
                          >
                            {MODELS.map(model => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="prompt-input-wrapper">
                          <textarea
                            placeholder="Enter prompt template..."
                            value={block.prompt}
                            onChange={e => handleBlockChange(block.id, { prompt: e.target.value })}
                            onFocus={() => setShowVariableHints(true)}
                            onBlur={() => setShowVariableHints(false)}
                          />
                          {showVariableHints && (
                            <div className="variable-hints">
                              <div className="hint-title">Available Variables:</div>
                              {newApp.blocks.map((b, index) => {
                                if (b.id === block.id) return null
                                return (
                                  <div key={b.id} className="hint-item">
                                    <code>@block{index + 1}</code>
                                    <span className="hint-preview">
                                      {(b.output || b.content || '').substring(0, 30)}...
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        {block.output && (
                          <div className="output-display">
                            <pre>{block.output}</pre>
                            <button 
                              className="copy-button"
                              onClick={() => navigator.clipboard.writeText(block.output)}
                            >
                              Copy
                            </button>
                          </div>
                        )}
                        <button onClick={() => generateOutput(block.id, block.prompt)}>
                          Generate
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="block-actions">
                <button onClick={() => handleAddBlock('input', 'static')}>Add Static Text</button>
                <button onClick={() => handleAddBlock('input', 'user')}>Add User Input</button>
                <button onClick={() => handleAddBlock('output')}>Add AI Output</button>
              </div>

              <div className="modal-footer">
                <button className="save-button" onClick={handleSaveApp}>Save App</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeApp && (
        <div className="app-view">
          <div className="app-view-header">
            <button className="back-button" onClick={() => setActiveApp(null)}>←</button>
            <h2>{activeApp.title}</h2>
          </div>
          
          <div className="blocks">
            {activeApp.blocks.map((block, index) => (
              <div key={block.id} className={`block ${block.type}-block`}>
                {block.type === 'input' ? (
                  <div className="input-block">
                    <label>Input {index + 1}</label>
                    {block.inputType === 'static' ? (
                      <div className="static-text">{block.content}</div>
                    ) : (
                      <textarea
                        placeholder="Enter your text here..."
                        value={blockOutputs[block.id] || ''}
                        onChange={(e) => setBlockOutputs(prev => ({
                          ...prev,
                          [block.id]: e.target.value
                        }))}
                      />
                    )}
                  </div>
                ) : (
                  <div className="output-block">
                    <div className="block-header">
                      <label>Output {index + 1}</label>
                      <span className="model-name">{
                        MODELS.find(m => m.id === block.model)?.name
                      }</span>
                    </div>
                    <div className="output-display">
                      {blockOutputs[block.id] ? (
                        <>
                          <pre>{blockOutputs[block.id]}</pre>
                          <button 
                            className="copy-button"
                            onClick={() => navigator.clipboard.writeText(blockOutputs[block.id])}
                          >
                            Copy
                          </button>
                        </>
                      ) : (
                        <div className="waiting">Waiting to run...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button 
            className="run-button"
            onClick={handleRunApp}
            disabled={isProcessing}
          >
            {isProcessing ? 'Running...' : 'Run App'}
          </button>
        </div>
      )}
    </div>
  )
}

export default App
