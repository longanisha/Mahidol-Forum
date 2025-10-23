import React from 'react';

const TagsPage = () => {
  // Mock data for tags
  const tags = [
    { name: 'AI', count: 45, color: 'bg-blue-100 text-blue-800' },
    { name: 'ICT', count: 32, color: 'bg-green-100 text-green-800' },
    { name: 'Courses', count: 28, color: 'bg-purple-100 text-purple-800' },
    { name: 'Sports', count: 15, color: 'bg-orange-100 text-orange-800' },
    { name: 'Events', count: 22, color: 'bg-pink-100 text-pink-800' },
    { name: 'English', count: 18, color: 'bg-indigo-100 text-indigo-800' },
    { name: 'Thai', count: 12, color: 'bg-red-100 text-red-800' },
    { name: 'Language', count: 25, color: 'bg-yellow-100 text-yellow-800' },
    { name: 'Discuss', count: 38, color: 'bg-gray-100 text-gray-800' },
    { name: 'Digital Nomad', count: 8, color: 'bg-teal-100 text-teal-800' },
    { name: 'Upwork', count: 5, color: 'bg-cyan-100 text-cyan-800' },
    { name: 'Campus', count: 20, color: 'bg-emerald-100 text-emerald-800' },
    { name: 'Dorm', count: 14, color: 'bg-lime-100 text-lime-800' },
    { name: 'Application', count: 16, color: 'bg-amber-100 text-amber-800' },
    { name: 'Graduate', count: 19, color: 'bg-violet-100 text-violet-800' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
        <p className="mt-2 text-gray-600">
          Browse discussions by topics and categories
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
   Content here
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Can't find what you're looking for?
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Create a new discussion with your own tags or suggest new categories for the forum.
              </p>
            </div>
            <div className="mt-4">
              <button className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-200">
                Start a Discussion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagsPage;
