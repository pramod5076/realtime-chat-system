import React, { useContext } from 'react'
import { AuthContext } from './context/AuthContext'
import Login from './components/Login'
import Chat from './components/Chat'

function App() {
  const { user } = useContext(AuthContext)

  return (
    <div className="min-h-screen">
      {!user ? <Login /> : <Chat />}
    </div>
  )
}

export default App
