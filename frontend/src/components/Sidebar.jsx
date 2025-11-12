import { Children, useState } from 'react'
import { Link, useLocation } from 'react-router';
import announcementIcon from '../assets/announcement.svg'
import forumIcon from '../assets/forum_icon.svg'
import tagIcon from '../assets/tag_icon.svg'

import '../style/Sidebar.css'

const Sidebar = () => {
	
	return (  
			<aside id="sidebar" className={`fixed inset-y-0 left-0 z-30 w-75 transform md:translate-x-0 transition-transform ease-in-out duration-300 md:relative md:flex md:flex-col md:rounded-r-2xl`}>
				<nav className='h-full px-3 py-4 overflow-y-auto bg-white shadow-md'>
					<div className='py-5 ml-auto flex justify-center'>
						<button className='p-1.5 w-4/5 rounded-lg bg-blue-900 hover:bg-blue-950 text-white font-medium'>
							Post a topic
						</button>
					</div>
					<div className='py-4'/>
					{/* Menu */}
					<p className='text-gray-600 px-2 text-left font-medium text-sm shadow-xs'>MENU</p>

					<SidebarItems icon={forumIcon} size={20} text="Dashboard" path='/'>
					</SidebarItems>
					<SidebarItems icon={tagIcon} size={20} text="Tags" path='/tags'>
					</SidebarItems>
					<SidebarItems icon={announcementIcon} size={20} text="Announcements" path='/announcements' alert>
					</SidebarItems>

				</nav>
			</aside>
	)
}

export function SidebarItems({icon, text, path, alert}){
	const location = useLocation();

	const isActive = (path) => {
		return location.pathname === path;
	};	
	return(
			<Link 
				to={path}
				className={`
				relative flex items-center py-2 px-3 my-1
				font-medium rounded-md cursor-pointer
				transition-colors
				${
					isActive(path)
						? "bg-linear-to-tr from-indigo-200 to-indigo-100 text-indigo-800"
						: "hover:bg-indigo-50 text-gray-600"
				}
			`}>
				<img src={icon}></img>
				<span className='w-10 ml-4'>{text}</span>
				{alert && (<div className={'absolute right-2 w-2 h-2 rounded bg-indigo-400'} />)}
			</Link>
	)
}

export default Sidebar;