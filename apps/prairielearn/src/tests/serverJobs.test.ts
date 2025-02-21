import { assert } from 'chai';
import stripAnsi = require('strip-ansi');
import { logger } from '@prairielearn/logger';

import * as serverJobs from '../lib/server-jobs-legacy';
import { createServerJob } from '../lib/server-jobs';
import * as helperServer from './helperServer';

function disableLoggingForTests() {
  let originalSilent;
  before(() => {
    originalSilent = logger.silent;
    logger.silent = true;
  });
  after(() => {
    logger.silent = originalSilent;
  });
}

describe('server-jobs', () => {
  before(helperServer.before());
  after(helperServer.after);

  disableLoggingForTests();

  it('runs a job', async () => {
    const serverJob = await createServerJob({
      type: 'test',
      description: 'test server job',
    });

    await serverJob.execute(async (context) => {
      context.info('testing info');
      context.error('testing error');
    });

    const finishedJobSequence = await serverJobs.getJobSequenceAsync(serverJob.jobSequenceId, null);

    assert.equal(finishedJobSequence.type, 'test');
    assert.equal(finishedJobSequence.description, 'test server job');
    assert.equal(finishedJobSequence.status, 'Success');
    assert.lengthOf(finishedJobSequence.jobs, 1);

    const job = finishedJobSequence.jobs[0];
    assert.equal(job.type, 'test');
    assert.equal(job.description, 'test server job');
    assert.equal(job.status, 'Success');
    assert.equal(stripAnsi(job.output), 'testing info\ntesting error\n');
  });

  it('runs a job with an error', async () => {
    const serverJob = await createServerJob({
      type: 'test',
      description: 'test job sequence',
    });

    await assert.isRejected(
      serverJob.execute(async (context) => {
        context.info('testing info');
        throw new Error('failing job');
      }),
      'failing job'
    );

    const finishedJobSequence = await serverJobs.getJobSequenceAsync(serverJob.jobSequenceId, null);

    assert.equal(finishedJobSequence.status, 'Error');
    assert.lengthOf(finishedJobSequence.jobs, 1);

    const job = finishedJobSequence.jobs[0];
    assert.equal(job.status, 'Error');
    assert.match(stripAnsi(job.output), /^testing info\nError: failing job\n\s+at/);
  });
});
