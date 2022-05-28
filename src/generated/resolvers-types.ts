import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  UUID: any;
};

export type AddEmailToNotionResult = {
  __typename?: 'AddEmailToNotionResult';
  notionPageId?: Maybe<Scalars['String']>;
  success?: Maybe<Scalars['Boolean']>;
};

export type Email = {
  emailID?: InputMaybe<Scalars['Int']>;
  emailThreadID?: InputMaybe<Scalars['Int']>;
  from?: InputMaybe<Scalars['String']>;
  plainTextContent?: InputMaybe<Scalars['String']>;
  subject?: InputMaybe<Scalars['String']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addEmailToNotion?: Maybe<AddEmailToNotionResult>;
  deleteNotionTableProperties?: Maybe<Array<Maybe<Scalars['String']>>>;
  formatNotionTable?: Maybe<Scalars['Boolean']>;
  updateDecoEmail?: Maybe<UpdateDecoEmailResult>;
  wipeNotionDatabase?: Maybe<Array<Maybe<Scalars['String']>>>;
};


export type MutationAddEmailToNotionArgs = {
  newEmail?: InputMaybe<Email>;
  toAddress?: InputMaybe<Scalars['String']>;
};


export type MutationUpdateDecoEmailArgs = {
  username?: InputMaybe<Scalars['String']>;
};

export type NotionDatabaseInfo = {
  __typename?: 'NotionDatabaseInfo';
  icon?: Maybe<Scalars['String']>;
  needsFormatting?: Maybe<Scalars['Boolean']>;
  title?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
};

export type NotionIntegration = {
  __typename?: 'NotionIntegration';
  avatarUrl?: Maybe<Scalars['String']>;
  botId?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['String']>;
  tokenType?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
  userFullName?: Maybe<Scalars['String']>;
  userId?: Maybe<Scalars['String']>;
  userfrontUserId?: Maybe<Scalars['String']>;
  workspaceIcon?: Maybe<Scalars['String']>;
  workspaceId?: Maybe<Scalars['String']>;
  workspaceName?: Maybe<Scalars['String']>;
};

export type Query = {
  __typename?: 'Query';
  currentUser?: Maybe<User>;
  emailUsernameAvailable?: Maybe<Scalars['Boolean']>;
  getCurrentUserNotionDatabaseInfo?: Maybe<NotionDatabaseInfo>;
  getCurrentUserNotionIntegration?: Maybe<NotionIntegration>;
  getUserMetaByDecoEmail?: Maybe<Scalars['Boolean']>;
};


export type QueryEmailUsernameAvailableArgs = {
  username: Scalars['String'];
};


export type QueryGetUserMetaByDecoEmailArgs = {
  decoEmail?: InputMaybe<Scalars['String']>;
};

export enum UpdateDecoEmailErrorReasons {
  AlreadyTaken = 'ALREADY_TAKEN',
  CannotChangeEmail = 'CANNOT_CHANGE_EMAIL',
  InvalidCharacters = 'INVALID_CHARACTERS'
}

export type UpdateDecoEmailResult = {
  __typename?: 'UpdateDecoEmailResult';
  errorReason?: Maybe<UpdateDecoEmailErrorReasons>;
  success: Scalars['Boolean'];
};

export type User = {
  __typename?: 'User';
  emailAddress?: Maybe<Scalars['String']>;
  fullName?: Maybe<Scalars['String']>;
  signupEmail?: Maybe<Scalars['String']>;
  userfrontID?: Maybe<Scalars['UUID']>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AddEmailToNotionResult: ResolverTypeWrapper<AddEmailToNotionResult>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Email: Email;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Mutation: ResolverTypeWrapper<{}>;
  NotionDatabaseInfo: ResolverTypeWrapper<NotionDatabaseInfo>;
  NotionIntegration: ResolverTypeWrapper<NotionIntegration>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']>;
  UUID: ResolverTypeWrapper<Scalars['UUID']>;
  UpdateDecoEmailErrorReasons: UpdateDecoEmailErrorReasons;
  UpdateDecoEmailResult: ResolverTypeWrapper<UpdateDecoEmailResult>;
  User: ResolverTypeWrapper<User>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AddEmailToNotionResult: AddEmailToNotionResult;
  Boolean: Scalars['Boolean'];
  Email: Email;
  Int: Scalars['Int'];
  Mutation: {};
  NotionDatabaseInfo: NotionDatabaseInfo;
  NotionIntegration: NotionIntegration;
  Query: {};
  String: Scalars['String'];
  UUID: Scalars['UUID'];
  UpdateDecoEmailResult: UpdateDecoEmailResult;
  User: User;
}>;

export type AddEmailToNotionResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['AddEmailToNotionResult'] = ResolversParentTypes['AddEmailToNotionResult']> = ResolversObject<{
  notionPageId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  addEmailToNotion?: Resolver<Maybe<ResolversTypes['AddEmailToNotionResult']>, ParentType, ContextType, Partial<MutationAddEmailToNotionArgs>>;
  deleteNotionTableProperties?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  formatNotionTable?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  updateDecoEmail?: Resolver<Maybe<ResolversTypes['UpdateDecoEmailResult']>, ParentType, ContextType, Partial<MutationUpdateDecoEmailArgs>>;
  wipeNotionDatabase?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
}>;

export type NotionDatabaseInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['NotionDatabaseInfo'] = ResolversParentTypes['NotionDatabaseInfo']> = ResolversObject<{
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  needsFormatting?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NotionIntegrationResolvers<ContextType = any, ParentType extends ResolversParentTypes['NotionIntegration'] = ResolversParentTypes['NotionIntegration']> = ResolversObject<{
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  botId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tokenType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userFullName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userfrontUserId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  workspaceIcon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  workspaceId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  workspaceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  currentUser?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  emailUsernameAvailable?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<QueryEmailUsernameAvailableArgs, 'username'>>;
  getCurrentUserNotionDatabaseInfo?: Resolver<Maybe<ResolversTypes['NotionDatabaseInfo']>, ParentType, ContextType>;
  getCurrentUserNotionIntegration?: Resolver<Maybe<ResolversTypes['NotionIntegration']>, ParentType, ContextType>;
  getUserMetaByDecoEmail?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, Partial<QueryGetUserMetaByDecoEmailArgs>>;
}>;

export interface UuidScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['UUID'], any> {
  name: 'UUID';
}

export type UpdateDecoEmailResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['UpdateDecoEmailResult'] = ResolversParentTypes['UpdateDecoEmailResult']> = ResolversObject<{
  errorReason?: Resolver<Maybe<ResolversTypes['UpdateDecoEmailErrorReasons']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  emailAddress?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  fullName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  signupEmail?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userfrontID?: Resolver<Maybe<ResolversTypes['UUID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = any> = ResolversObject<{
  AddEmailToNotionResult?: AddEmailToNotionResultResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NotionDatabaseInfo?: NotionDatabaseInfoResolvers<ContextType>;
  NotionIntegration?: NotionIntegrationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  UUID?: GraphQLScalarType;
  UpdateDecoEmailResult?: UpdateDecoEmailResultResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
}>;

