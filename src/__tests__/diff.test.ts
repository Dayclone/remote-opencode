import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataStore from '../services/dataStore.js';
import { diff } from '../commands/diff.js';

// Mock dataStore
vi.mock('../services/dataStore.js', () => ({
  getChannelProjectPath: vi.fn(),
  getWorktreeMapping: vi.fn(),
}));

// Mock node:child_process. diff.ts uses promisify(execFile), which calls
// execFile(file, args, options, callback).
vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (err: unknown, result: { stdout: string; stderr: string }) => void,
    ) => {
      callback(null, { stdout: 'diff output', stderr: '' });
    },
  ),
}));

describe('diff command', () => {
  let mockInteraction: any;

  function makeInteraction(overrides: Partial<any> = {}) {
    return {
      channelId: 'thread-123',
      channel: { isThread: () => false, parentId: 'channel-456' },
      reply: vi.fn().mockResolvedValue(undefined),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      options: {
        getString: vi.fn().mockReturnValue(null),
        getBoolean: vi.fn().mockReturnValue(null),
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockInteraction = makeInteraction();
  });

  it('should return error if no project is bound', async () => {
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue(undefined);
    vi.mocked(dataStore.getChannelProjectPath).mockReturnValue(undefined);

    await diff.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('❌ No project bound') }),
    );
  });

  it('should show diff for project path', async () => {
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue(undefined);
    vi.mocked(dataStore.getChannelProjectPath).mockReturnValue('/path/to/project');

    await diff.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('diff output'));
  });

  it('should show diff for worktree path if in a thread', async () => {
    mockInteraction = makeInteraction({
      channel: { isThread: () => true, parentId: 'channel-456' },
    });
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue({
      worktreePath: '/path/to/worktree',
    } as any);

    await diff.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('diff output'));
  });

  it('should respect the staged target option', async () => {
    vi.mocked(dataStore.getWorktreeMapping).mockReturnValue(undefined);
    vi.mocked(dataStore.getChannelProjectPath).mockReturnValue('/path/to/project');
    mockInteraction.options.getString.mockImplementation((name: string) =>
      name === 'target' ? 'staged' : null,
    );

    await diff.execute(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.stringContaining('diff output'));
  });
});
