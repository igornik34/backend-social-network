export class PaginationParams {
    limit?: number = 10;
    offset?: number = 0;
  }
  
  export class FollowerInfo {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string;
    isFollowing?: boolean;
    followsYou?: boolean;
  }
  
  export class FollowersResponse {
    data: FollowerInfo[];
    total: number;
    hasMore: boolean;
  }

  export class SuggestedUserDto extends FollowerInfo {
    mutualFollowersCount: number;
  }