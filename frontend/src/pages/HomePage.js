import React from 'react';
import DiscussionCard from '../components/DiscussionCard';

const HomePage = () => {
  // Mock data - in real app, this would come from API
  const discussions = [
    {
      id: 1,
      user: {
        name: 'Karmen',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
        timeAgo: '5 min ago'
      },
      title: 'How to apply to Mahidol graduate programs?',
      description: "I'm looking for information to apply graduate programs this year.......",
      tags: ['ICT', 'Courses', 'Application'],
      stats: {
        views: 125,
        comments: 15,
        upvotes: 155
      }
    },
    {
      id: 2,
      user: {
        name: 'Shiraj',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
        timeAgo: '25 min ago'
      },
      title: 'Does Mahidol provide dorm for international students?',
      description: "I'm first year ICT student and currently looking a place to live near campus....",
      tags: ['ICT', 'Campus', 'Dorm'],
      stats: {
        views: 125,
        comments: 15,
        upvotes: 155
      }
    },
    {
      id: 3,
      user: {
        name: 'Dew',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80',
        timeAgo: '2 days ago'
      },
      title: 'Any Thai language classes in Mahidol?',
      description: 'I would like to learn basic Thai, like how to speak in Thai..........',
      tags: ['svelte', 'javascript', 'recomendations'],
      stats: {
        views: 125,
        comments: 15,
        upvotes: 155
      }
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Discussions</h1>
      <div className="space-y-4">
        {discussions.map((discussion) => (
          <DiscussionCard key={discussion.id} discussion={discussion} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
