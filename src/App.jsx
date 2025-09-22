import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
            Welcome to
          </div>
          <h1 className="block mt-1 text-lg leading-tight font-medium text-black">
            My Web Project
          </h1>
          <p className="mt-2 text-gray-500">
            A modern React app with Tailwind CSS, Vite, and TypeScript support.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App