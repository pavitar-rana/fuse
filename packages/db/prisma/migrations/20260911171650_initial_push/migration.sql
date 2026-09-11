-- CreateEnum
CREATE TYPE "VmStatus" AS ENUM ('CREATING', 'RUNNING', 'PAUSED', 'TERMINATING', 'TERMINATED', 'FAILED');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('AVAILABLE', 'ALLOCATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "apiKey" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Virtualmachine" (
    "id" TEXT NOT NULL,
    "vmIp" TEXT NOT NULL,
    "vmMac" TEXT NOT NULL,
    "socket" TEXT NOT NULL,
    "rootfsPath" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vcpuCount" INTEGER NOT NULL,
    "memSize" INTEGER NOT NULL,
    "status" "VmStatus" NOT NULL DEFAULT 'CREATING',
    "hostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Virtualmachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortMapping" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "vmPort" INTEGER NOT NULL,
    "hostPort" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipRange" TEXT NOT NULL,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpPool" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "vmId" TEXT,

    CONSTRAINT "IpPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortPool" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostPort" INTEGER NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "vmId" TEXT,

    CONSTRAINT "PortPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "PortMapping_vmId_vmPort_key" ON "PortMapping"("vmId", "vmPort");

-- CreateIndex
CREATE UNIQUE INDEX "Host_hostname_key" ON "Host"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "IpPool_vmId_key" ON "IpPool"("vmId");

-- CreateIndex
CREATE INDEX "IpPool_hostId_status_idx" ON "IpPool"("hostId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IpPool_hostId_ip_key" ON "IpPool"("hostId", "ip");

-- CreateIndex
CREATE INDEX "PortPool_hostId_status_idx" ON "PortPool"("hostId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PortPool_hostId_hostPort_key" ON "PortPool"("hostId", "hostPort");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Virtualmachine" ADD CONSTRAINT "Virtualmachine_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Virtualmachine" ADD CONSTRAINT "Virtualmachine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortMapping" ADD CONSTRAINT "PortMapping_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "Virtualmachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpPool" ADD CONSTRAINT "IpPool_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortPool" ADD CONSTRAINT "PortPool_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
