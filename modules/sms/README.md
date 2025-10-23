# ⚠️ DEPRECATED: SMS Module

This module has been **deprecated** and replaced by the **Communications** module.

## Migration

Please migrate to: `modules/communications`

See migration guide: `modules/communications/MIGRATION_GUIDE.md`

## What Changed

- All SMS functionality has been moved to the Communications module
- The Communications module provides all SMS features plus new orchestration capabilities
- Zero code changes needed - the grpc-sdk automatically routes to Communications
- New features available: multi-channel messaging, fallback chains, unified templates

## Timeline

- **Current**: SMS module is deprecated but still functional
- **Future**: SMS module will be removed in a future release
- **Action Required**: Migrate to Communications module when convenient
