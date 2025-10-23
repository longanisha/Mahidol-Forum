import React from 'react';

const AnnouncementsPage = () => {
  // Mock data for announcements


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        <p className="mt-2 text-gray-600">
          Stay updated with the latest news and important information
        </p>
      </div>

      <div className="space-y-4">
      Announcements Here
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-6H4v6zM4 5h6V1H4v4zM15 3h5l-5-5v5z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No more announcements</h3>
          <p className="mt-1 text-sm text-gray-500">
            You're all caught up! Check back later for new updates.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsPage;
