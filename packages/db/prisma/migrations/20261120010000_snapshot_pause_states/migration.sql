-- Transitional states while a snapshot is being written / loaded.
ALTER TYPE "VmStatus" ADD VALUE 'PAUSING' AFTER 'RUNNING';
ALTER TYPE "VmStatus" ADD VALUE 'RESUMING' AFTER 'PAUSED';
