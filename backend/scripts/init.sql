-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token_balance BIGINT DEFAULT 1000,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    visibility VARCHAR(20) DEFAULT 'private',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Storage Files (Universal file tracking)
CREATE TABLE storage_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(1000) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'dataset', 'model', 'checkpoint', 'log'
    mime_type VARCHAR(100),
    file_size BIGINT DEFAULT 0,
    checksum VARCHAR(64),
    storage_location VARCHAR(20) DEFAULT 'local', -- 'local', 'distributed'
    metadata JSONB DEFAULT '{}',
    access_level VARCHAR(20) DEFAULT 'private', -- 'public', 'private', 'shared'
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Datasets
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_file_id UUID REFERENCES storage_files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) DEFAULT 'v1.0',
    description TEXT,
    task_type VARCHAR(100),
    format VARCHAR(50), -- 'csv', 'json', 'parquet', 'hf_dataset'
    schema_info JSONB DEFAULT '{}',
    row_count INTEGER,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Models
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_file_id UUID REFERENCES storage_files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) DEFAULT 'v1.0',
    base_model VARCHAR(255),
    task_type VARCHAR(100),
    framework VARCHAR(50), -- 'pytorch', 'transformers', 'tensorflow'
    model_size VARCHAR(50),
    metrics JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Training Jobs
CREATE TABLE training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id),
    job_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    base_model VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    current_epoch INTEGER,
    total_epochs INTEGER,
    cost_incurred DECIMAL(10,4) DEFAULT 0,
    vast_instance_id UUID,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vast.ai Instances
CREATE TABLE vast_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    training_job_id UUID REFERENCES training_jobs(id),
    vast_contract_id BIGINT NOT NULL,
    gpu_type VARCHAR(100),
    gpu_count INTEGER DEFAULT 1,
    hourly_cost DECIMAL(8,4) NOT NULL,
    region VARCHAR(100),
    ssh_host VARCHAR(255),
    ssh_port INTEGER,
    status VARCHAR(50) DEFAULT 'provisioning',
    created_at TIMESTAMP DEFAULT NOW(),
    terminated_at TIMESTAMP
);

-- Billing Transactions
CREATE TABLE billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    training_job_id UUID REFERENCES training_jobs(id),
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,4) NOT NULL,
    vast_cost DECIMAL(10,4),
    platform_fee DECIMAL(10,4),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Upload Sessions (for resumable uploads)
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    chunk_size INTEGER DEFAULT 1048576,
    total_chunks INTEGER NOT NULL,
    uploaded_chunks INTEGER DEFAULT 0,
    temp_path VARCHAR(500),
    final_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_storage_files_user_id ON storage_files(user_id);
CREATE INDEX idx_storage_files_path ON storage_files(file_path);
CREATE INDEX idx_training_jobs_user_id ON training_jobs(user_id);
CREATE INDEX idx_training_jobs_status ON training_jobs(status);
CREATE INDEX idx_vast_instances_status ON vast_instances(status);
