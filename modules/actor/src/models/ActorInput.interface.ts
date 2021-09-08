
export interface Actor{
  name: string;
  options: any;
}

export interface ActorInput<T>{
  actorOptions: T;
  context: {
    data: any;
    // previousNodes: Actor[];
    // followingNodes: Actor[];
  }
}
