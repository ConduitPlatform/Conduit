# ⚠️ DEPRECATED: Email Module

This module has been **deprecated** and replaced by the **Communications** module.

## Migration

Please migrate to: `modules/communications`

See migration guide: `modules/communications/MIGRATION_GUIDE.md`

## What Changed

- All email functionality has been moved to the Communications module
- The Communications module provides all email features plus new orchestration capabilities
- Zero code changes needed - the grpc-sdk automatically routes to Communications
- New features available: multi-channel messaging, fallback chains, unified templates

## Timeline

- **Current**: Email module is deprecated but still functional
- **Future**: Email module will be removed in a future release
- **Action Required**: Migrate to Communications module when convenient
