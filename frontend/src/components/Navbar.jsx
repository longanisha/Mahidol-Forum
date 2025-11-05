import forumlogo from '../assets/forum_logo.png'
import React from 'react';
import '../style/Sidebar.css'

const Navbar = () => {
    return (
        <nav className=' w-full z-20 border-b shrink-0 border-gray-100 bg-white shadow-sm '>
			<div className='w-full px-4 sm:px-6 lg:px-8 p-4'>
				<div className='flex items-center h-16'>
					<div className='flex items-center'>
						<a href="#" className='flex items-center space-x-3 rtl:space-x-reverse md:order-1 '>
							<img 
								src={forumlogo} 
								className='w-16 h-16' 
								alt="mahidol logo"
							/>
							<span 
								className='self-center text-2xl font-semibold whitespace-nowrap'>
								Mahidol Forum
							</span>
						</a>
					</div>
					
					<div className='flex-1 hidden md:flex items-center justify-center px-2 lg:px-6'>
						<div className='max-w-xl w-full'>
							<label htmlFor="search-desktop" className='sr-only'>Search</label>
							<div className='relative'>
								<div className='absolute inset-y-0 left-0 pl-3 flex items-center ps-3 pointer-events-none'>
									<svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
										<path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
									</svg>
								</div>
								<input type="search" id="default-search" className="block w-full p-4 ps-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 " 
									placeholder="Search by keywords..." 
									required 
								/>
							</div>
						</div>
					</div>
					
					<div className='flex items-center'>
						<div className='relative'>
							<div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-xs">
								ES
							</div>
						</div>
					</div>
				</div>
			</div>
        </nav>
    );
}

export default Navbar;