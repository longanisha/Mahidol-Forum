-- Initial database schema for Mahidol Forum
-- This file contains the SQL commands to create all necessary tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    bio TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin'))
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discussions table
CREATE TABLE IF NOT EXISTS discussions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    upvotes INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discussion tags junction table
CREATE TABLE IF NOT EXISTS discussion_tags (
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (discussion_id, tag_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    upvotes INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User announcements junction table (to track read status)
CREATE TABLE IF NOT EXISTS user_announcements (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, announcement_id)
);

-- User upvotes table (to prevent duplicate upvotes)
CREATE TABLE IF NOT EXISTS user_upvotes (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    discussion_id INTEGER REFERENCES discussions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, discussion_id)
);

-- Comment upvotes table
CREATE TABLE IF NOT EXISTS comment_upvotes (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, comment_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discussions_author_id ON discussions(author_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_views ON discussions(views DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_upvotes ON discussions(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_comments_discussion_id ON comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_discussion_tags_discussion_id ON discussion_tags(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_tags_tag_id ON discussion_tags(tag_id);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discussions_updated_at BEFORE UPDATE ON discussions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update discussion comment count
CREATE OR REPLACE FUNCTION update_discussion_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE discussions 
        SET comments = comments + 1 
        WHERE id = NEW.discussion_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE discussions 
        SET comments = comments - 1 
        WHERE id = OLD.discussion_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for comment count
CREATE TRIGGER update_comment_count_trigger
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_discussion_comment_count();

-- Function to update tag count
CREATE OR REPLACE FUNCTION update_tag_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags 
        SET count = count + 1 
        WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags 
        SET count = count - 1 
        WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for tag count
CREATE TRIGGER update_tag_count_trigger
    AFTER INSERT OR DELETE ON discussion_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_count();

-- Insert some initial tags
INSERT INTO tags (name, description, color) VALUES
    ('AI', 'Artificial Intelligence discussions', '#3B82F6'),
    ('ICT', 'Information and Communication Technology', '#10B981'),
    ('Courses', 'Course-related discussions', '#8B5CF6'),
    ('Sports', 'Sports and physical activities', '#F59E0B'),
    ('Events', 'University events and activities', '#EF4444'),
    ('English', 'English language discussions', '#06B6D4'),
    ('Thai', 'Thai language discussions', '#84CC16'),
    ('Language', 'Language learning and practice', '#F97316'),
    ('Discuss', 'General discussions', '#6B7280'),
    ('Digital Nomad', 'Remote work and digital nomad lifestyle', '#EC4899'),
    ('Upwork', 'Freelancing and Upwork discussions', '#8B5CF6'),
    ('Campus', 'Campus life and facilities', '#10B981'),
    ('Dorm', 'Dormitory and accommodation', '#F59E0B'),
    ('Application', 'Application processes and procedures', '#3B82F6'),
    ('Graduate', 'Graduate studies and programs', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;
