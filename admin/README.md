# Admin Module

The admin package, will expose the entire conduit's configuration to the admin panel,
and allow for config changes, plugin installation, log viewing, metric viewing, push
notification status and generally admin things.

THIS SHOULD BE BUILT WITH NEXT.JS I THINK, SO THAT EACH MODULE DESCRIBES THEIR
INTERFACE AND NEXT.JS WOULD RENDER IT SERVER-SIDE.

Each package should expose an "admin" set of functions, with the appropriate UI
as a React component. Then the Next.js server will dynamically import the UI component
and since the component will call functions for the plugin's admin tools it
will be as extendable as we want it to be. That's the theory at least.

It is important to remember that the Next.js server is DIFFERENT from the rest of the packages
