import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Sidebar from "./components/Sidebar.jsx"
import Navbar from './components/Navbar.jsx'
import ForumPost from './components/ForumPost.jsx'
import { postList } from './data/mockup.jsx'


function App() {
  return (
    <>
      <div className='absolute inset-0 flex flex-col h-screen bg-gray-50 antialiased'>
        <Navbar />
        <div className='flex flex-1 overflow-hidden pt1-6'>
          <Sidebar/>
          <div className='flex flex-col flex-1 overflow-y-auto'>

            <main className='flex-1 p-4 sm:p-6 lg:p-8'>
              <h1 className='text-3x1 font-bold text-gray-800 mb-6'>Tags Placeholder</h1>
              <ForumPost posts={ postList }/>
            </main>
          </div>
          
        </div>
      </div>
    </>
  )
}

export default App
