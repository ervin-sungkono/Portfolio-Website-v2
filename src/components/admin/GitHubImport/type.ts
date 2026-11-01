export type ImportRepository = {
  id: number;
  ownerId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  defaultBranch: string;
  language: string | null;
  archived: boolean;
  fork: boolean;
  ownedByPatOwner: boolean;
};
