import React, { useState } from 'react'
import avatar from './assets/forum_logo.png'

function ForumPost({ posts }){
    const postItems = posts.map(post =>  
        <div className='grow bg-white shadow-md rounded-lg p-6'>
            <div key={post.id} >
                <div className='flex items-center gap-4'>
                    <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs">
						{post.user.avatar}
					</div>
                    <span className='text-md font-semibold'>{post.user.username}</span>
                </div>
                <h3 className='text-justify text-l font-semibold mb-2'>{post.title} : </h3>
                <p className='text-left text-gray-600 mb-4'>{post.description}</p>
                <div className='flex items-center gap-4'>
                    <div className='text-sm text-gray-400'>By: {post.user.username}</div>
                </div>
                
            </div>
        </div>
    );
    return (
        <>
            <div className='grid grid-cols-1 gap-6'>
                {postItems}   
            </div>
        </>
    );
    

}
export default ForumPost