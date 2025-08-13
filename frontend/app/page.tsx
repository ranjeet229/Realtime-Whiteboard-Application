'use client';

import dynamic from 'next/dynamic';

// Dynamically import Whiteboard to avoid SSR issues with canvas
const Whiteboard = dynamic(() => import('../components/Whiteboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Collaborative Whiteboard...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <Whiteboard />;
}
