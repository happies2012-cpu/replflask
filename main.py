import sqlite3
import json
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, g, session, redirect

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SESSION_SECRET', 'guidesoft-dev-secret-2026')

DATABASE = 'guidesoft.db'

# ─── Database Helpers ─────────────────────────────────────────────────────────

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    return (rv[0] if rv else None) if one else rv

def execute_db(query, args=()):
    db = get_db()
    cur = db.execute(query, args)
    db.commit()
    return cur.lastrowid

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def rows_to_list(rows):
    return [dict(r) for r in rows]

# ─── Init Database ─────────────────────────────────────────────────────────────

def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT,
            full_name TEXT,
            profile_image TEXT,
            role TEXT DEFAULT 'user',
            subscription_type TEXT DEFAULT 'free',
            points INTEGER DEFAULT 0,
            bio TEXT,
            theme TEXT DEFAULT 'light',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            priority TEXT DEFAULT 'medium',
            owner_id TEXT,
            category TEXT DEFAULT 'general',
            progress INTEGER DEFAULT 0,
            deadline TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            project_id INTEGER,
            assignee_id TEXT,
            creator_id TEXT,
            due_date TEXT,
            tags TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (assignee_id) REFERENCES users(id),
            FOREIGN KEY (creator_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            task_id INTEGER,
            author_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS content_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            body TEXT,
            category TEXT DEFAULT 'general',
            domain TEXT DEFAULT 'technology',
            author_id TEXT,
            status TEXT DEFAULT 'draft',
            tags TEXT DEFAULT '[]',
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            image_url TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (author_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT,
            location TEXT,
            type TEXT DEFAULT 'full-time',
            domain TEXT DEFAULT 'technology',
            description TEXT,
            requirements TEXT DEFAULT '[]',
            salary_min INTEGER,
            salary_max INTEGER,
            poster_id TEXT,
            status TEXT DEFAULT 'open',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (poster_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS job_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER,
            applicant_id TEXT,
            status TEXT DEFAULT 'pending',
            cover_letter TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (job_id) REFERENCES jobs(id),
            FOREIGN KEY (applicant_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'organization',
            domain TEXT DEFAULT 'technology',
            description TEXT,
            website TEXT,
            contact_email TEXT,
            owner_id TEXT,
            status TEXT DEFAULT 'active',
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            metadata TEXT DEFAULT '{}',
            ip_address TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            title TEXT NOT NULL,
            message TEXT,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            plan TEXT NOT NULL,
            amount INTEGER NOT NULL,
            currency TEXT DEFAULT 'INR',
            status TEXT DEFAULT 'pending',
            transaction_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    
    # Seed sample data
    existing = db.execute("SELECT COUNT(*) FROM content_items").fetchone()[0]
    if existing == 0:
        db.executescript("""
            INSERT OR IGNORE INTO content_items (title, body, category, domain, status, tags, views, likes, image_url) VALUES
            ('Getting Started with AI in 2026', 'Artificial intelligence has transformed every industry...', 'tutorial', 'technology', 'published', '["AI","ML","2026"]', 1240, 89, 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400'),
            ('Top 10 Programming Languages This Year', 'The software landscape continues to evolve rapidly...', 'article', 'technology', 'published', '["coding","programming"]', 980, 67, 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400'),
            ('Remote Work Best Practices', 'Working from home effectively requires discipline...', 'guide', 'business', 'published', '["remote","work","productivity"]', 750, 45, 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=400'),
            ('Investment Strategies for Beginners', 'Starting your investment journey can be overwhelming...', 'article', 'finance', 'published', '["finance","investing","beginner"]', 1100, 72, 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400'),
            ('Health & Wellness in the Digital Age', 'Balancing screen time and physical health...', 'guide', 'health', 'published', '["health","wellness","digital"]', 890, 55, 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400'),
            ('E-commerce Trends to Watch', 'Online shopping has reached new heights...', 'article', 'ecommerce', 'published', '["ecommerce","shopping","trends"]', 670, 38, 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400');

            INSERT OR IGNORE INTO jobs (title, company, location, type, domain, description, salary_min, salary_max, status) VALUES
            ('Senior Full-Stack Developer', 'TechCorp India', 'Bangalore', 'full-time', 'technology', 'We are looking for a senior developer to lead our product team...', 1500000, 2500000, 'open'),
            ('AI/ML Engineer', 'DataMind Labs', 'Remote', 'full-time', 'technology', 'Join our AI research team to build next-gen models...', 1800000, 3000000, 'open'),
            ('Product Designer', 'DesignStudio', 'Mumbai', 'full-time', 'business', 'Create beautiful user experiences for millions...', 900000, 1500000, 'open'),
            ('Digital Marketing Manager', 'GrowthHive', 'Delhi', 'full-time', 'business', 'Drive growth through data-driven marketing strategies...', 800000, 1200000, 'open'),
            ('Freelance Content Writer', 'ContentFirst', 'Remote', 'freelance', 'business', 'Write engaging content for tech and finance clients...', 30000, 80000, 'open'),
            ('DevOps Engineer', 'CloudNine', 'Hyderabad', 'full-time', 'technology', 'Manage cloud infrastructure and CI/CD pipelines...', 1200000, 2000000, 'open');

            INSERT OR IGNORE INTO entities (name, type, domain, description, website, status) VALUES
            ('TechVentures India', 'organization', 'technology', 'A leading tech incubator supporting startups across India', 'https://techventures.in', 'active'),
            ('FinanceHub', 'organization', 'finance', 'Financial advisory and investment platform', 'https://financehub.co', 'active'),
            ('HealthFirst Clinic', 'organization', 'health', 'Multi-specialty healthcare provider with digital-first approach', 'https://healthfirst.in', 'active'),
            ('EduLearn Academy', 'organization', 'education', 'Online education platform with 500+ courses', 'https://edulearn.in', 'active'),
            ('ShopEasy', 'organization', 'ecommerce', 'B2B e-commerce solutions for small businesses', 'https://shopeasy.in', 'active');
        """)
    
    db.commit()
    db.close()

# ─── Auth Helpers ──────────────────────────────────────────────────────────────

def get_current_user():
    user_id = request.headers.get('X-Replit-User-Id', '')
    user_name = request.headers.get('X-Replit-User-Name', '')
    if not user_id:
        return None
    
    db = get_db()
    user = row_to_dict(db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
    if not user:
        full_name = request.headers.get('X-Replit-User-Name', user_name)
        profile_image = request.headers.get('X-Replit-User-Profile-Image', '')
        email = f"{user_name}@replit.user"
        db.execute(
            "INSERT OR IGNORE INTO users (id, username, email, full_name, profile_image) VALUES (?,?,?,?,?)",
            (user_id, user_name, email, full_name, profile_image)
        )
        db.commit()
        user = row_to_dict(db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
    return user

def log_activity(user_id, action, resource_type=None, resource_id=None, metadata=None):
    try:
        execute_db(
            "INSERT INTO activity_log (user_id, action, resource_type, resource_id, metadata, ip_address) VALUES (?,?,?,?,?,?)",
            (user_id, action, resource_type, str(resource_id) if resource_id else None,
             json.dumps(metadata or {}), request.remote_addr)
        )
    except Exception:
        pass

# ─── Main SPA Route ────────────────────────────────────────────────────────────

@app.route('/')
@app.route('/<path:path>')
def index(path=''):
    user = get_current_user()
    return render_template('index.html', user=user)

# ─── Auth API ──────────────────────────────────────────────────────────────────

@app.route('/api/auth/me')
def auth_me():
    user = get_current_user()
    if not user:
        return jsonify({'authenticated': False, 'user': None})
    return jsonify({'authenticated': True, 'user': user})

@app.route('/api/auth/update-theme', methods=['POST'])
def update_theme():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    theme = data.get('theme', 'light')
    execute_db("UPDATE users SET theme=? WHERE id=?", (theme, user['id']))
    return jsonify({'success': True})

# ─── Dashboard API ────────────────────────────────────────────────────────────

@app.route('/api/dashboard/stats')
def dashboard_stats():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    uid = user['id']
    projects_count = query_db("SELECT COUNT(*) as c FROM projects WHERE owner_id=?", (uid,), one=True)['c']
    tasks_count = query_db("SELECT COUNT(*) as c FROM tasks WHERE assignee_id=? OR creator_id=?", (uid, uid), one=True)['c']
    tasks_done = query_db("SELECT COUNT(*) as c FROM tasks WHERE (assignee_id=? OR creator_id=?) AND status='done'", (uid, uid), one=True)['c']
    content_count = query_db("SELECT COUNT(*) as c FROM content_items WHERE author_id=?", (uid,), one=True)['c']
    recent_activity = rows_to_list(query_db("SELECT * FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 10", (uid,)))
    notifications = rows_to_list(query_db("SELECT * FROM notifications WHERE user_id=? AND is_read=0 ORDER BY created_at DESC LIMIT 5", (uid,)))
    
    return jsonify({
        'stats': {
            'projects': projects_count,
            'tasks': tasks_count,
            'tasks_done': tasks_done,
            'content': content_count,
            'points': user.get('points', 0)
        },
        'recent_activity': recent_activity,
        'notifications': notifications
    })

# ─── Projects API ─────────────────────────────────────────────────────────────

@app.route('/api/projects', methods=['GET', 'POST'])
def projects():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        items = rows_to_list(query_db("SELECT p.*, u.full_name as owner_name FROM projects p LEFT JOIN users u ON p.owner_id=u.id WHERE p.owner_id=? ORDER BY p.created_at DESC", (user['id'],)))
        return jsonify({'projects': items})
    
    data = request.json
    pid = execute_db(
        "INSERT INTO projects (title, description, status, priority, owner_id, category, deadline) VALUES (?,?,?,?,?,?,?)",
        (data['title'], data.get('description', ''), data.get('status', 'active'),
         data.get('priority', 'medium'), user['id'], data.get('category', 'general'), data.get('deadline'))
    )
    log_activity(user['id'], 'created_project', 'project', pid, {'title': data['title']})
    project = row_to_dict(query_db("SELECT * FROM projects WHERE id=?", (pid,), one=True))
    return jsonify({'project': project}), 201

@app.route('/api/projects/<int:pid>', methods=['GET', 'PUT', 'DELETE'])
def project_detail(pid):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    project = row_to_dict(query_db("SELECT * FROM projects WHERE id=?", (pid,), one=True))
    if not project:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'GET':
        tasks = rows_to_list(query_db("SELECT * FROM tasks WHERE project_id=? ORDER BY created_at DESC", (pid,)))
        return jsonify({'project': project, 'tasks': tasks})
    
    if project['owner_id'] != user['id']:
        return jsonify({'error': 'Forbidden'}), 403
    
    if request.method == 'PUT':
        data = request.json
        execute_db(
            "UPDATE projects SET title=?, description=?, status=?, priority=?, category=?, progress=?, deadline=?, updated_at=datetime('now') WHERE id=?",
            (data.get('title', project['title']), data.get('description', project['description']),
             data.get('status', project['status']), data.get('priority', project['priority']),
             data.get('category', project['category']), data.get('progress', project['progress']),
             data.get('deadline', project['deadline']), pid)
        )
        return jsonify({'project': row_to_dict(query_db("SELECT * FROM projects WHERE id=?", (pid,), one=True))})
    
    execute_db("DELETE FROM tasks WHERE project_id=?", (pid,))
    execute_db("DELETE FROM projects WHERE id=?", (pid,))
    return jsonify({'success': True})

# ─── Tasks API ────────────────────────────────────────────────────────────────

@app.route('/api/tasks', methods=['GET', 'POST'])
def tasks():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'GET':
        project_id = request.args.get('project_id')
        if project_id:
            items = rows_to_list(query_db("SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id=u.id WHERE t.project_id=? ORDER BY t.created_at DESC", (project_id,)))
        else:
            items = rows_to_list(query_db("SELECT t.*, u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id=u.id WHERE t.assignee_id=? OR t.creator_id=? ORDER BY t.created_at DESC LIMIT 50", (user['id'], user['id'])))
        return jsonify({'tasks': items})
    
    data = request.json
    tid = execute_db(
        "INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, creator_id, due_date, tags) VALUES (?,?,?,?,?,?,?,?,?)",
        (data['title'], data.get('description', ''), data.get('status', 'todo'),
         data.get('priority', 'medium'), data.get('project_id'), data.get('assignee_id'),
         user['id'], data.get('due_date'), json.dumps(data.get('tags', [])))
    )
    log_activity(user['id'], 'created_task', 'task', tid, {'title': data['title']})
    task = row_to_dict(query_db("SELECT * FROM tasks WHERE id=?", (tid,), one=True))
    return jsonify({'task': task}), 201

@app.route('/api/tasks/<int:tid>', methods=['GET', 'PUT', 'DELETE'])
def task_detail(tid):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    task = row_to_dict(query_db("SELECT * FROM tasks WHERE id=?", (tid,), one=True))
    if not task:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'GET':
        comments = rows_to_list(query_db("SELECT c.*, u.full_name as author_name, u.profile_image as author_image FROM comments c LEFT JOIN users u ON c.author_id=u.id WHERE c.task_id=? ORDER BY c.created_at ASC", (tid,)))
        return jsonify({'task': task, 'comments': comments})
    
    if request.method == 'PUT':
        data = request.json
        execute_db(
            "UPDATE tasks SET title=?, description=?, status=?, priority=?, due_date=?, tags=?, assignee_id=?, updated_at=datetime('now') WHERE id=?",
            (data.get('title', task['title']), data.get('description', task['description']),
             data.get('status', task['status']), data.get('priority', task['priority']),
             data.get('due_date', task['due_date']), json.dumps(data.get('tags', [])),
             data.get('assignee_id', task['assignee_id']), tid)
        )
        log_activity(user['id'], 'updated_task', 'task', tid)
        return jsonify({'task': row_to_dict(query_db("SELECT * FROM tasks WHERE id=?", (tid,), one=True))})
    
    execute_db("DELETE FROM comments WHERE task_id=?", (tid,))
    execute_db("DELETE FROM tasks WHERE id=?", (tid,))
    return jsonify({'success': True})

@app.route('/api/tasks/<int:tid>/comments', methods=['POST'])
def add_comment(tid):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    cid = execute_db("INSERT INTO comments (content, task_id, author_id) VALUES (?,?,?)",
                     (data['content'], tid, user['id']))
    comment = row_to_dict(query_db("SELECT c.*, u.full_name as author_name, u.profile_image as author_image FROM comments c LEFT JOIN users u ON c.author_id=u.id WHERE c.id=?", (cid,), one=True))
    return jsonify({'comment': comment}), 201

# ─── Content API ──────────────────────────────────────────────────────────────

@app.route('/api/content', methods=['GET', 'POST'])
def content():
    domain = request.args.get('domain')
    category = request.args.get('category')
    search = request.args.get('search', '')
    
    q = "SELECT c.*, u.full_name as author_name FROM content_items c LEFT JOIN users u ON c.author_id=u.id WHERE c.status='published'"
    args = []
    if domain:
        q += " AND c.domain=?"; args.append(domain)
    if category:
        q += " AND c.category=?"; args.append(category)
    if search:
        q += " AND (c.title LIKE ? OR c.body LIKE ?)"; args += [f'%{search}%', f'%{search}%']
    q += " ORDER BY c.created_at DESC LIMIT 20"
    
    if request.method == 'GET':
        items = rows_to_list(query_db(q, args))
        return jsonify({'content': items})
    
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    cid = execute_db(
        "INSERT INTO content_items (title, body, category, domain, author_id, status, tags, image_url) VALUES (?,?,?,?,?,?,?,?)",
        (data['title'], data.get('body', ''), data.get('category', 'article'),
         data.get('domain', 'technology'), user['id'], data.get('status', 'draft'),
         json.dumps(data.get('tags', [])), data.get('image_url', ''))
    )
    item = row_to_dict(query_db("SELECT * FROM content_items WHERE id=?", (cid,), one=True))
    return jsonify({'content': item}), 201

@app.route('/api/content/<int:cid>', methods=['GET', 'PUT', 'DELETE'])
def content_detail(cid):
    user = get_current_user()
    execute_db("UPDATE content_items SET views=views+1 WHERE id=?", (cid,))
    item = row_to_dict(query_db("SELECT c.*, u.full_name as author_name FROM content_items c LEFT JOIN users u ON c.author_id=u.id WHERE c.id=?", (cid,), one=True))
    if not item:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'GET':
        return jsonify({'content': item})
    
    if not user or item.get('author_id') != user['id']:
        return jsonify({'error': 'Forbidden'}), 403
    
    if request.method == 'PUT':
        data = request.json
        execute_db(
            "UPDATE content_items SET title=?, body=?, category=?, domain=?, status=?, tags=?, image_url=?, updated_at=datetime('now') WHERE id=?",
            (data.get('title', item['title']), data.get('body', item['body']),
             data.get('category', item['category']), data.get('domain', item['domain']),
             data.get('status', item['status']), json.dumps(data.get('tags', [])),
             data.get('image_url', item['image_url']), cid)
        )
        return jsonify({'content': row_to_dict(query_db("SELECT * FROM content_items WHERE id=?", (cid,), one=True))})
    
    execute_db("DELETE FROM content_items WHERE id=?", (cid,))
    return jsonify({'success': True})

@app.route('/api/content/<int:cid>/like', methods=['POST'])
def like_content(cid):
    execute_db("UPDATE content_items SET likes=likes+1 WHERE id=?", (cid,))
    item = row_to_dict(query_db("SELECT likes FROM content_items WHERE id=?", (cid,), one=True))
    return jsonify({'likes': item['likes'] if item else 0})

# ─── Jobs API ─────────────────────────────────────────────────────────────────

@app.route('/api/jobs', methods=['GET', 'POST'])
def jobs():
    domain = request.args.get('domain')
    job_type = request.args.get('type')
    search = request.args.get('search', '')
    
    q = "SELECT j.*, u.full_name as poster_name FROM jobs j LEFT JOIN users u ON j.poster_id=u.id WHERE j.status='open'"
    args = []
    if domain:
        q += " AND j.domain=?"; args.append(domain)
    if job_type:
        q += " AND j.type=?"; args.append(job_type)
    if search:
        q += " AND (j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ?)"; args += [f'%{search}%', f'%{search}%', f'%{search}%']
    q += " ORDER BY j.created_at DESC LIMIT 50"
    
    if request.method == 'GET':
        items = rows_to_list(query_db(q, args))
        return jsonify({'jobs': items})
    
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    jid = execute_db(
        "INSERT INTO jobs (title, company, location, type, domain, description, requirements, salary_min, salary_max, poster_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (data['title'], data.get('company', ''), data.get('location', 'Remote'),
         data.get('type', 'full-time'), data.get('domain', 'technology'),
         data.get('description', ''), json.dumps(data.get('requirements', [])),
         data.get('salary_min'), data.get('salary_max'), user['id'])
    )
    job = row_to_dict(query_db("SELECT * FROM jobs WHERE id=?", (jid,), one=True))
    return jsonify({'job': job}), 201

@app.route('/api/jobs/<int:jid>/apply', methods=['POST'])
def apply_job(jid):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    existing = query_db("SELECT id FROM job_applications WHERE job_id=? AND applicant_id=?", (jid, user['id']), one=True)
    if existing:
        return jsonify({'error': 'Already applied'}), 400
    aid = execute_db("INSERT INTO job_applications (job_id, applicant_id, cover_letter) VALUES (?,?,?)",
                     (jid, user['id'], data.get('cover_letter', '')))
    log_activity(user['id'], 'applied_job', 'job', jid)
    return jsonify({'application_id': aid, 'message': 'Application submitted!'}), 201

# ─── Entities API ─────────────────────────────────────────────────────────────

@app.route('/api/entities', methods=['GET', 'POST'])
def entities():
    domain = request.args.get('domain')
    entity_type = request.args.get('type')
    search = request.args.get('search', '')
    
    q = "SELECT e.*, u.full_name as owner_name FROM entities e LEFT JOIN users u ON e.owner_id=u.id WHERE e.status='active'"
    args = []
    if domain:
        q += " AND e.domain=?"; args.append(domain)
    if entity_type:
        q += " AND e.type=?"; args.append(entity_type)
    if search:
        q += " AND (e.name LIKE ? OR e.description LIKE ?)"; args += [f'%{search}%', f'%{search}%']
    q += " ORDER BY e.created_at DESC LIMIT 50"
    
    if request.method == 'GET':
        items = rows_to_list(query_db(q, args))
        return jsonify({'entities': items})
    
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    eid = execute_db(
        "INSERT INTO entities (name, type, domain, description, website, contact_email, owner_id, metadata) VALUES (?,?,?,?,?,?,?,?)",
        (data['name'], data.get('type', 'organization'), data.get('domain', 'technology'),
         data.get('description', ''), data.get('website', ''), data.get('contact_email', ''),
         user['id'], json.dumps(data.get('metadata', {})))
    )
    entity = row_to_dict(query_db("SELECT * FROM entities WHERE id=?", (eid,), one=True))
    return jsonify({'entity': entity}), 201

@app.route('/api/entities/<int:eid>', methods=['PUT', 'DELETE'])
def entity_detail(eid):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    entity = row_to_dict(query_db("SELECT * FROM entities WHERE id=?", (eid,), one=True))
    if not entity:
        return jsonify({'error': 'Not found'}), 404
    if entity['owner_id'] != user['id']:
        return jsonify({'error': 'Forbidden'}), 403
    if request.method == 'DELETE':
        execute_db("DELETE FROM entities WHERE id=?", (eid,))
        return jsonify({'success': True})
    data = request.json
    execute_db("UPDATE entities SET name=?, type=?, domain=?, description=?, website=?, contact_email=?, metadata=?, updated_at=datetime('now') WHERE id=?",
               (data.get('name', entity['name']), data.get('type', entity['type']),
                data.get('domain', entity['domain']), data.get('description', entity['description']),
                data.get('website', entity['website']), data.get('contact_email', entity['contact_email']),
                json.dumps(data.get('metadata', {})), eid))
    return jsonify({'entity': row_to_dict(query_db("SELECT * FROM entities WHERE id=?", (eid,), one=True))})

# ─── Activity API ─────────────────────────────────────────────────────────────

@app.route('/api/activity')
def activity():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    page = int(request.args.get('page', 1))
    per_page = 20
    offset = (page - 1) * per_page
    items = rows_to_list(query_db("SELECT * FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?", (user['id'], per_page, offset)))
    total = query_db("SELECT COUNT(*) as c FROM activity_log WHERE user_id=?", (user['id'],), one=True)['c']
    return jsonify({'activity': items, 'total': total, 'page': page})

# ─── Search API ───────────────────────────────────────────────────────────────

@app.route('/api/search')
def search():
    q = request.args.get('q', '').strip()
    if not q or len(q) < 2:
        return jsonify({'results': []})
    
    results = []
    content = rows_to_list(query_db("SELECT id, title, domain, 'content' as type FROM content_items WHERE title LIKE ? AND status='published' LIMIT 5", (f'%{q}%',)))
    jobs = rows_to_list(query_db("SELECT id, title, company as subtitle, domain, 'job' as type FROM jobs WHERE (title LIKE ? OR company LIKE ?) AND status='open' LIMIT 5", (f'%{q}%', f'%{q}%')))
    entities = rows_to_list(query_db("SELECT id, name as title, type as subtitle, domain, 'entity' as type FROM entities WHERE name LIKE ? AND status='active' LIMIT 5", (f'%{q}%',)))
    results = content + jobs + entities
    return jsonify({'results': results, 'query': q})

# ─── Notifications API ────────────────────────────────────────────────────────

@app.route('/api/notifications', methods=['GET'])
def notifications():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    items = rows_to_list(query_db("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20", (user['id'],)))
    return jsonify({'notifications': items})

@app.route('/api/notifications/<int:nid>/read', methods=['POST'])
def mark_notification_read(nid):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    execute_db("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?", (nid, user['id']))
    return jsonify({'success': True})

# ─── Payment API ──────────────────────────────────────────────────────────────

@app.route('/api/payments/initiate', methods=['POST'])
def initiate_payment():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    plan = data.get('plan', 'premium')
    amount = 200 if plan == 'premium' else 500
    pid = execute_db("INSERT INTO payments (user_id, plan, amount, status) VALUES (?,?,?,'pending')", (user['id'], plan, amount))
    return jsonify({'payment_id': pid, 'amount': amount, 'currency': 'INR', 'plan': plan})

@app.route('/api/payments/confirm', methods=['POST'])
def confirm_payment():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    pid = data.get('payment_id')
    execute_db("UPDATE payments SET status='completed', transaction_id=? WHERE id=? AND user_id=?",
               (f"TXN{pid}_{user['id'][:6]}", pid, user['id']))
    execute_db("UPDATE users SET subscription_type='premium', points=points+100 WHERE id=?", (user['id'],))
    log_activity(user['id'], 'payment_completed', 'payment', pid)
    return jsonify({'success': True, 'message': 'Payment confirmed! You are now premium.'})

# ─── User Profile API ─────────────────────────────────────────────────────────

@app.route('/api/users/profile', methods=['GET', 'PUT'])
def user_profile():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if request.method == 'GET':
        return jsonify({'user': user})
    data = request.json
    execute_db("UPDATE users SET full_name=?, bio=?, updated_at=datetime('now') WHERE id=?",
               (data.get('full_name', user['full_name']), data.get('bio', user.get('bio', '')), user['id']))
    return jsonify({'user': row_to_dict(query_db("SELECT * FROM users WHERE id=?", (user['id'],), one=True))})

# ─── Stats for Technology Page ────────────────────────────────────────────────

@app.route('/api/tech/stats')
def tech_stats():
    content_count = query_db("SELECT COUNT(*) as c FROM content_items WHERE domain='technology' AND status='published'", one=True)['c']
    jobs_count = query_db("SELECT COUNT(*) as c FROM jobs WHERE domain='technology' AND status='open'", one=True)['c']
    entities_count = query_db("SELECT COUNT(*) as c FROM entities WHERE domain='technology' AND status='active'", one=True)['c']
    return jsonify({'content': content_count, 'jobs': jobs_count, 'entities': entities_count})

# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False)
