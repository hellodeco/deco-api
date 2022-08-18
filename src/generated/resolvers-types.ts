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

export type ConnectedNotionEntities = {
  __typename?: 'ConnectedNotionEntities';
  databases?: Maybe<Array<Maybe<NotionDatabaseInfo>>>;
  pages?: Maybe<Array<Maybe<NotionPage>>>;
};

export type CreateUserfrontAndDecoUserResult = {
  __typename?: 'CreateUserfrontAndDecoUserResult';
  errorMessage?: Maybe<Scalars['String']>;
  success: Scalars['Boolean'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createUserfrontAndDecoUser?: Maybe<CreateUserfrontAndDecoUserResult>;
  deleteNotionTableProperties?: Maybe<Array<Maybe<Scalars['String']>>>;
  formatNotionTable?: Maybe<Scalars['Boolean']>;
  selectNotionDatabase?: Maybe<Scalars['Boolean']>;
  sendMailBeta?: Maybe<SendMailBetaResult>;
  setDecoEmail?: Maybe<UpdateDecoEmailResult>;
  wipeNotionDatabase?: Maybe<Array<Maybe<Scalars['String']>>>;
};


export type MutationCreateUserfrontAndDecoUserArgs = {
  email?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
};


export type MutationSelectNotionDatabaseArgs = {
  databaseId: Scalars['String'];
};


export type MutationSendMailBetaArgs = {
  args?: InputMaybe<SendMailBetaArgs>;
  email: SendMailBetaEmail;
};


export type MutationSetDecoEmailArgs = {
  username?: InputMaybe<Scalars['String']>;
};

export type NotionDatabaseInfo = {
  __typename?: 'NotionDatabaseInfo';
  icon?: Maybe<Scalars['String']>;
  needsFormatting?: Maybe<Scalars['Boolean']>;
  needsManualFormatting?: Maybe<Scalars['Boolean']>;
  status?: Maybe<NotionDatabaseStatus>;
  title?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
};

export enum NotionDatabaseStatus {
  Connected = 'CONNECTED',
  NotConnected = 'NOT_CONNECTED',
  NotShared = 'NOT_SHARED'
}

export type NotionFile = {
  __typename?: 'NotionFile';
  url?: Maybe<Scalars['String']>;
};

export type NotionIcon = {
  __typename?: 'NotionIcon';
  emoji?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
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

export type NotionPage = {
  __typename?: 'NotionPage';
  icon?: Maybe<NotionIcon>;
  id?: Maybe<Scalars['String']>;
  title?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
};

export type Query = {
  __typename?: 'Query';
  connectedNotionPages?: Maybe<Array<Maybe<NotionPage>>>;
  currentUser?: Maybe<User>;
  currentUserHasFileAccess?: Maybe<Scalars['Boolean']>;
  emailDomain?: Maybe<Scalars['String']>;
  emailUsernameAvailable?: Maybe<Scalars['Boolean']>;
  getCurrentUserNotionDatabaseInfo?: Maybe<NotionDatabaseInfo>;
  getCurrentUserNotionIntegration?: Maybe<NotionIntegration>;
};


export type QueryCurrentUserHasFileAccessArgs = {
  attachmentId: Scalars['String'];
};


export type QueryEmailUsernameAvailableArgs = {
  username: Scalars['String'];
};

export type SendMailBetaArgs = {
  inReplyToEmailId?: InputMaybe<Scalars['Int']>;
};

export type SendMailBetaAttachmentInput = {
  id: Scalars['String'];
  mimetype: Scalars['String'];
  name: Scalars['String'];
  size?: InputMaybe<Scalars['Int']>;
};

export type SendMailBetaEmail = {
  attachments?: InputMaybe<Array<InputMaybe<SendMailBetaAttachmentInput>>>;
  bcc?: InputMaybe<Array<InputMaybe<SendMailBetaRecipientInput>>>;
  cc?: InputMaybe<Array<InputMaybe<SendMailBetaRecipientInput>>>;
  plainTextContent?: InputMaybe<Scalars['String']>;
  subject?: InputMaybe<Scalars['String']>;
  to: Array<SendMailBetaRecipientInput>;
};

export type SendMailBetaRecipientInput = {
  email: Scalars['String'];
  name?: InputMaybe<Scalars['String']>;
};

export type SendMailBetaResult = {
  __typename?: 'SendMailBetaResult';
  message?: Maybe<Scalars['String']>;
  success?: Maybe<Scalars['Boolean']>;
};

export enum UpdateDecoEmailErrorReasons {
  AlreadyTaken = 'ALREADY_TAKEN',
  CannotChangeEmail = 'CANNOT_CHANGE_EMAIL',
  InvalidFormat = 'INVALID_FORMAT',
  NotEnoughChars = 'NOT_ENOUGH_CHARS',
  NoSubscription = 'NO_SUBSCRIPTION'
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
  subscriptionStatus?: Maybe<Scalars['String']>;
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
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  ConnectedNotionEntities: ResolverTypeWrapper<ConnectedNotionEntities>;
  CreateUserfrontAndDecoUserResult: ResolverTypeWrapper<CreateUserfrontAndDecoUserResult>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Mutation: ResolverTypeWrapper<{}>;
  NotionDatabaseInfo: ResolverTypeWrapper<NotionDatabaseInfo>;
  NotionDatabaseStatus: NotionDatabaseStatus;
  NotionFile: ResolverTypeWrapper<NotionFile>;
  NotionIcon: ResolverTypeWrapper<NotionIcon>;
  NotionIntegration: ResolverTypeWrapper<NotionIntegration>;
  NotionPage: ResolverTypeWrapper<NotionPage>;
  Query: ResolverTypeWrapper<{}>;
  SendMailBetaArgs: SendMailBetaArgs;
  SendMailBetaAttachmentInput: SendMailBetaAttachmentInput;
  SendMailBetaEmail: SendMailBetaEmail;
  SendMailBetaRecipientInput: SendMailBetaRecipientInput;
  SendMailBetaResult: ResolverTypeWrapper<SendMailBetaResult>;
  String: ResolverTypeWrapper<Scalars['String']>;
  UUID: ResolverTypeWrapper<Scalars['UUID']>;
  UpdateDecoEmailErrorReasons: UpdateDecoEmailErrorReasons;
  UpdateDecoEmailResult: ResolverTypeWrapper<UpdateDecoEmailResult>;
  User: ResolverTypeWrapper<User>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean'];
  ConnectedNotionEntities: ConnectedNotionEntities;
  CreateUserfrontAndDecoUserResult: CreateUserfrontAndDecoUserResult;
  Int: Scalars['Int'];
  Mutation: {};
  NotionDatabaseInfo: NotionDatabaseInfo;
  NotionFile: NotionFile;
  NotionIcon: NotionIcon;
  NotionIntegration: NotionIntegration;
  NotionPage: NotionPage;
  Query: {};
  SendMailBetaArgs: SendMailBetaArgs;
  SendMailBetaAttachmentInput: SendMailBetaAttachmentInput;
  SendMailBetaEmail: SendMailBetaEmail;
  SendMailBetaRecipientInput: SendMailBetaRecipientInput;
  SendMailBetaResult: SendMailBetaResult;
  String: Scalars['String'];
  UUID: Scalars['UUID'];
  UpdateDecoEmailResult: UpdateDecoEmailResult;
  User: User;
}>;

export type ConnectedNotionEntitiesResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConnectedNotionEntities'] = ResolversParentTypes['ConnectedNotionEntities']> = ResolversObject<{
  databases?: Resolver<Maybe<Array<Maybe<ResolversTypes['NotionDatabaseInfo']>>>, ParentType, ContextType>;
  pages?: Resolver<Maybe<Array<Maybe<ResolversTypes['NotionPage']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CreateUserfrontAndDecoUserResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateUserfrontAndDecoUserResult'] = ResolversParentTypes['CreateUserfrontAndDecoUserResult']> = ResolversObject<{
  errorMessage?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createUserfrontAndDecoUser?: Resolver<Maybe<ResolversTypes['CreateUserfrontAndDecoUserResult']>, ParentType, ContextType, Partial<MutationCreateUserfrontAndDecoUserArgs>>;
  deleteNotionTableProperties?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  formatNotionTable?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  selectNotionDatabase?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<MutationSelectNotionDatabaseArgs, 'databaseId'>>;
  sendMailBeta?: Resolver<Maybe<ResolversTypes['SendMailBetaResult']>, ParentType, ContextType, RequireFields<MutationSendMailBetaArgs, 'email'>>;
  setDecoEmail?: Resolver<Maybe<ResolversTypes['UpdateDecoEmailResult']>, ParentType, ContextType, Partial<MutationSetDecoEmailArgs>>;
  wipeNotionDatabase?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
}>;

export type NotionDatabaseInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['NotionDatabaseInfo'] = ResolversParentTypes['NotionDatabaseInfo']> = ResolversObject<{
  icon?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  needsFormatting?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  needsManualFormatting?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['NotionDatabaseStatus']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NotionFileResolvers<ContextType = any, ParentType extends ResolversParentTypes['NotionFile'] = ResolversParentTypes['NotionFile']> = ResolversObject<{
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type NotionIconResolvers<ContextType = any, ParentType extends ResolversParentTypes['NotionIcon'] = ResolversParentTypes['NotionIcon']> = ResolversObject<{
  emoji?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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

export type NotionPageResolvers<ContextType = any, ParentType extends ResolversParentTypes['NotionPage'] = ResolversParentTypes['NotionPage']> = ResolversObject<{
  icon?: Resolver<Maybe<ResolversTypes['NotionIcon']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  connectedNotionPages?: Resolver<Maybe<Array<Maybe<ResolversTypes['NotionPage']>>>, ParentType, ContextType>;
  currentUser?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  currentUserHasFileAccess?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<QueryCurrentUserHasFileAccessArgs, 'attachmentId'>>;
  emailDomain?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  emailUsernameAvailable?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType, RequireFields<QueryEmailUsernameAvailableArgs, 'username'>>;
  getCurrentUserNotionDatabaseInfo?: Resolver<Maybe<ResolversTypes['NotionDatabaseInfo']>, ParentType, ContextType>;
  getCurrentUserNotionIntegration?: Resolver<Maybe<ResolversTypes['NotionIntegration']>, ParentType, ContextType>;
}>;

export type SendMailBetaResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['SendMailBetaResult'] = ResolversParentTypes['SendMailBetaResult']> = ResolversObject<{
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
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
  subscriptionStatus?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  userfrontID?: Resolver<Maybe<ResolversTypes['UUID']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = any> = ResolversObject<{
  ConnectedNotionEntities?: ConnectedNotionEntitiesResolvers<ContextType>;
  CreateUserfrontAndDecoUserResult?: CreateUserfrontAndDecoUserResultResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NotionDatabaseInfo?: NotionDatabaseInfoResolvers<ContextType>;
  NotionFile?: NotionFileResolvers<ContextType>;
  NotionIcon?: NotionIconResolvers<ContextType>;
  NotionIntegration?: NotionIntegrationResolvers<ContextType>;
  NotionPage?: NotionPageResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SendMailBetaResult?: SendMailBetaResultResolvers<ContextType>;
  UUID?: GraphQLScalarType;
  UpdateDecoEmailResult?: UpdateDecoEmailResultResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
}>;

