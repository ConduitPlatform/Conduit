class RouteTrieNode {
  children: Map<string, RouteTrieNode>;
  methods: Map<string, string>; // Map of HTTP methods to route paths
  isEndpoint: boolean;

  constructor() {
    this.children = new Map();
    this.methods = new Map();
    this.isEndpoint = false;
  }
}

export class RouteTrie {
  root: RouteTrieNode;

  constructor() {
    this.root = new RouteTrieNode();
  }

  insert(method: string, routePath: string) {
    const segments = routePath.split('/').filter(Boolean);
    let currentNode = this.root;

    for (const segment of segments) {
      const key = segment.startsWith(':') ? ':param' : segment; // Treat all dynamic segments as ':param'
      if (!currentNode.children.has(key)) {
        currentNode.children.set(key, new RouteTrieNode());
      }
      currentNode = currentNode.children.get(key)!;
    }

    currentNode.isEndpoint = true;
    currentNode.methods.set(method.toUpperCase(), routePath);
  }

  match(method: string, path: string): string | null {
    const segments = path.split('/').filter(Boolean);
    let currentNode = this.root;

    for (const segment of segments) {
      if (currentNode.children.has(segment)) {
        currentNode = currentNode.children.get(segment)!;
      } else if (currentNode.children.has(':param')) {
        currentNode = currentNode.children.get(':param')!;
      } else {
        return null;
      }
    }

    return currentNode.methods.get(method.toUpperCase()) || null;
  }
}
