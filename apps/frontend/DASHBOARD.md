# Firecracker Cloud Dashboard

## Overview

The dashboard provides a comprehensive interface for managing your virtual machines and API keys for the Firecracker Cloud platform.

## Features

### 1. API Key Management

- **Generate API Key**: Click the "Generate API Key" button in the top-right corner to create a new API key
- **Copy to Clipboard**: Use the copy button in the dialog to easily copy your API key
- **Security Note**: API keys are only shown once upon generation. Store them securely.

### 2. Virtual Machine List

The dashboard displays all your VMs in a table format with the following information:

- **Name**: The custom name of your VM
- **VM ID**: Unique identifier for the VM
- **Status**: Current state (Running, Stopped, Error)
- **CPU**: Allocated vCPUs
- **Memory**: Allocated RAM
- **Created**: Creation date
- **Actions**: Quick access to view and manage VMs

### 3. Resource Statistics

Three stat cards at the bottom show:

- **Total VMs**: Number of VMs with running count
- **Total vCPUs**: Sum of all allocated CPU cores
- **Total Memory**: Sum of all allocated RAM

## Usage

### Creating a New VM

Click the "Create New VM" button in the VM list card to provision a new virtual machine.

### Managing VMs

Each VM has "View" and "Manage" action buttons for:
- Viewing detailed information
- Starting/stopping the VM
- Modifying resources
- Deleting the VM

### Using the API Key

Once generated, use your API key to authenticate API requests:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.firecracker.cloud/v1/vms
```

## Components Used

- **shadcn/ui** components:
  - Card
  - Button
  - Dialog
  - Table
  - Badge
- **Lucide React** icons
- **Next.js 14** with App Router
- **NextAuth.js** for authentication

## Future Enhancements

- [ ] Real-time VM status updates
- [ ] VM creation wizard
- [ ] Resource usage graphs
- [ ] API key management (list, revoke)
- [ ] VM logs and console access
- [ ] Billing and usage statistics