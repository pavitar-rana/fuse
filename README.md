# Own E2B - Cloud Execution Environment Backend

A powerful TypeScript-based backend service for creating and managing isolated Firecracker Virtual Machines for secure code execution. This project provides an E2B-like cloud execution environment with REST APIs for VM lifecycle management, secure SSH-based command execution, and file operations.

## 🚀 Features

- **Firecracker VM Management**: Create, manage, and delete lightweight Firecracker VMs
- **Secure SSH Integration**: Execute commands and manage files through SSH connections
- **REST API**: Full-featured Express.js API for VM and execution operations
- **Database Integration**: PostgreSQL with Prisma ORM for data persistence
- **Redis Caching**: Redis for session management and VM state tracking
- **Network Management**: Automatic TAP interface and bridge network setup
- **User Management**: Multi-user support with project isolation

## 🏗️ Architecture

### Core Components

#### 1. **API Layer** (`src/`)
- **Express Server** (`src/index.ts`): Main entry point running on port 8080
- **Routes** (`src/routes/`):
  - `/firecracker/*` - VM management endpoints
  - `/firecracker/exec/*` - Command execution endpoints

#### 2. **VM Management** (`src/firecracker/`)
- **VM Creation** (`firecracker.create.ts`): Provisions new Firecracker VMs
- **VM Deletion** (`firecracker.delete.ts`): Cleanup and resource deallocation
- **Network Setup** (`firecracker.network.ts`): TAP interfaces and bridge networking
- **VM Configuration** (`firecracker.config.ts`): VM resource configuration
- **Boot Management** (`firecracker.boot.ts`): VM startup procedures

#### 3. **Controllers** (`src/controller/`)
- **VM Controller** (`createVM.controller.ts`):
  - `POST /firecracker/create` - Create new VM
  - `POST /firecracker/delete` - Delete existing VM  
  - `POST /firecracker/get-host` - Get VM host URL
- **Execution Controller** (`exec.controller.ts`):
  - `POST /firecracker/exec/run` - Execute commands in VM
  - `POST /firecracker/exec/create-dir` - Create directories
  - `POST /firecracker/exec/write` - Write files to VM

#### 4. **Services** (`src/services/`)
- **SSH Service** (`ssh/`): Secure command execution and file operations
- **Redis Service** (`redis/`): Caching and session management

#### 5. **Database Layer** (`src/lib/`, `src/prisma/`)
- **Prisma ORM**: Database abstraction and type safety
- **Models**: User, Project, VirtualMachine, Session management

## 📊 Database Schema

```sql
User: User management with API keys
├── Projects: User's coding projects
├── Sessions: Authentication sessions
└── VirtualMachines: VM instances with network config

VirtualMachine:
- VM IP, MAC address, socket path
- Resource specs (vCPU, memory)
- Status tracking and user association
```

## 🌐 Network Architecture

- **Bridge Network**: `br0` (172.16.0.1/24)
- **VM IP Range**: 172.16.0.2 - 172.16.0.20
- **Host Port Mapping**: Each VM IP maps to specific host ports (8000-8018)
- **TAP Interfaces**: Dynamic TAP creation per VM
- **Internet Access**: NAT forwarding through host interface

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ with TypeScript support
- PostgreSQL database
- Redis server
- Firecracker binary and kernel images
- Ubuntu rootfs image for VMs
- Sudo access for network configuration

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repository>
cd own-e2b
npm install
```

2. **Set up environment variables**:
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/e2b"
DIRECT_URL="postgresql://username:password@localhost:5432/e2b"

# Add other required environment variables
```

3. **Database setup**:
```bash
npx prisma generate
npx prisma db push
```

4. **Prepare VM images** (update paths in controller):
```bash
# Download or build kernel and rootfs
# Update paths in src/controller/createVM.controller.ts:
# - kernelImage: "/path/to/vmlinux"
# - rootfsPath: "/path/to/ubuntu.ext4"
```

5. **Start the server**:
```bash
npm run dev
```

## 📡 API Endpoints

### VM Management

#### Create VM
```bash
POST /firecracker/create
{
  "userId": "user-id-here"
}
```

Returns VM details including IP, MAC, and connection info.

#### Delete VM
```bash
POST /firecracker/delete
{
  "id": "vm-id",
  "userId": "user-id"
}
```

#### Get VM Host URL
```bash
POST /firecracker/get-host
{
  "userId": "user-id",
  "ip": "172.16.0.2",
  "id": "vm-id"
}
```

### Command Execution

#### Run Command
```bash
POST /firecracker/exec/run
{
  "id": "vm-id",
  "userId": "user-id",
  "command": "ls -la",
  "projectId": "project-id",
  "path": "/optional/working/directory"
}
```

#### Create Directory
```bash
POST /firecracker/exec/create-dir
{
  "id": "vm-id",
  "userId": "user-id",
  "path": "/path/to/create"
}
```

#### Write File
```bash
POST /firecracker/exec/write
{
  "id": "vm-id",
  "userId": "user-id",
  "projectId": "project-id",
  "path": "filename.txt",
  "content": "file content here"
}
```

## 🔧 Configuration

### VM Default Settings
- **Memory**: 512MB
- **vCPUs**: 1
- **Network**: Bridge mode with internet access
- **SSH**: Automatic connection with retry logic

### File Structure

```
src/
├── controller/          # API request handlers
├── firecracker/         # VM management core
├── lib/                 # Utilities and database
│   ├── generated/       # Prisma generated client
│   └── prisma.ts       # Database connection
├── prisma/             # Database schema
├── routes/             # Express route definitions  
└── services/           # External service integrations
    ├── redis/          # Caching layer
    └── ssh/            # Secure command execution
```

## 🔐 Security Features

- **Isolated VMs**: Each user gets isolated Firecracker VMs
- **SSH Key Authentication**: Secure command execution
- **Network Isolation**: VMs run in isolated network namespaces  
- **Resource Limits**: Configurable CPU and memory constraints
- **User Isolation**: Database-level user and project separation

## 🛠️ Development

### Key Technologies
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Virtualization**: Firecracker VMM
- **SSH**: ssh2 library for secure connections

### Code Organization
- **Controllers**: Handle HTTP requests and responses
- **Services**: Reusable business logic components
- **Firecracker Module**: VM lifecycle management
- **Types**: TypeScript type definitions

## 📈 Scaling Considerations

- **VM Pool Management**: Redis tracks allocated IPs and resources
- **Connection Pooling**: SSH connections are pooled and reused
- **Resource Cleanup**: Automatic cleanup on VM deletion
- **Network Limits**: Supports up to 19 concurrent VMs (172.16.0.2-20)

## 🚨 Production Notes

- Update hardcoded VM image paths in controllers
- Configure proper logging and monitoring
- Set up proper authentication/authorization
- Review network security and firewall rules
- Monitor VM resource usage and cleanup orphaned VMs

## 🤝 Contributing

This appears to be a custom E2B implementation. When contributing:
- Follow TypeScript best practices
- Add proper error handling
- Update API documentation
- Test VM lifecycle operations
- Ensure proper resource cleanup

---

**Note**: This is a development setup. For production deployment, ensure proper security hardening, resource monitoring, and backup procedures.
