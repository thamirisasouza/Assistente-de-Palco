// Polyfills & Safeguards for Mobile & Translation Extensions

if (typeof globalThis === 'undefined') {
  (window as any).globalThis = window;
}

// Fix for Google Translate / Browser Extensions / DOM mutations causing "NotFoundError: Failed to execute 'removeChild' on 'Node'"
if (typeof window !== 'undefined' && typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child && child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Cannot remove a child from a different parent. Handled gracefully.', this, child);
      }
      return child;
    }
    return originalRemoveChild.apply(this, [child]) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Cannot insert before a reference node from a different parent. Handled gracefully.', this, referenceNode);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
  };
}
