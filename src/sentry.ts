import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

Sentry.init({
  dsn: "https://250cc79b794845f5ae81a2f1246ea548@o4504301014614016.ingest.sentry.io/4504301019856896",
  tracesSampleRate: 1.0,
});

const transaction = Sentry.startTransaction({
  op: "test",
  name: "My First Test Transaction",
});

setTimeout(() => {
  try {
	foo();
  } catch (e) {
	Sentry.captureException(e);
  } finally {
	transaction.finish();
  }
}, 99);